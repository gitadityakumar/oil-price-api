-- Enforce idempotent warehouse writes and fail-closed source governance.

alter table source_catalog
  add column if not exists ingestion_enabled boolean not null default false,
  add column if not exists public_display_enabled boolean not null default false,
  add column if not exists rights_status text not null default 'pending',
  add column if not exists terms_url text,
  add column if not exists terms_reviewed_at timestamptz,
  add column if not exists terms_evidence_uri text,
  add column if not exists allowed_hosts text[] not null default '{}'::text[],
  add column if not exists expected_cadence_minutes integer,
  add column if not exists adapter_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'source_catalog_rights_status_check'
  ) then
    alter table source_catalog add constraint source_catalog_rights_status_check
      check (rights_status in ('pending', 'approved', 'restricted', 'denied'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'source_catalog_public_rights_check'
  ) then
    alter table source_catalog add constraint source_catalog_public_rights_check
      check (not public_display_enabled or rights_status = 'approved');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'source_catalog_cadence_check'
  ) then
    alter table source_catalog add constraint source_catalog_cadence_check
      check (expected_cadence_minutes is null or expected_cadence_minutes > 0);
  end if;
end$$;

-- Merge duplicate geography identities before adding the natural key.
create temporary table geography_merge on commit drop as
with ranked as (
  select geography_id,
         first_value(geography_id) over (
           partition by lower(canonical_label), coalesce(pincode, '')
           order by geography_id
         ) as canonical_id
    from geography_dim
)
select geography_id as duplicate_id, canonical_id
  from ranked
 where geography_id <> canonical_id;

update price_fact_daily p
   set geography_id = m.canonical_id
  from geography_merge m
 where p.geography_id = m.duplicate_id;

update pincode_resolution r
   set geography_id = m.canonical_id
  from geography_merge m
 where r.geography_id = m.duplicate_id;

delete from geography_dim g
 using geography_merge m
 where g.geography_id = m.duplicate_id;

create unique index if not exists geography_dim_natural_uq
  on geography_dim (lower(canonical_label), coalesce(pincode, ''));

create table if not exists price_fact_alias (
  alias_public_id text primary key,
  price_fact_id bigint not null references price_fact_daily(price_fact_id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Preserve alternate public IDs while collapsing duplicate natural facts.
create temporary table price_fact_merge on commit drop as
with ranked as (
  select price_fact_id,
         public_id,
         first_value(price_fact_id) over (
           partition by source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind
           order by observed_at desc, confidence_score desc nulls last, updated_at desc, price_fact_id
         ) as canonical_id
    from price_fact_daily
)
select price_fact_id as duplicate_id, public_id as duplicate_public_id, canonical_id
  from ranked
 where price_fact_id <> canonical_id;

insert into price_fact_alias (alias_public_id, price_fact_id)
select duplicate_public_id, canonical_id from price_fact_merge
on conflict (alias_public_id) do update set price_fact_id = excluded.price_fact_id;

insert into price_component_fact (price_fact_id, component_name, component_value, component_unit)
select m.canonical_id, c.component_name, c.component_value, c.component_unit
  from price_component_fact c
  join price_fact_merge m on m.duplicate_id = c.price_fact_id
 where not exists (
   select 1 from price_component_fact existing
    where existing.price_fact_id = m.canonical_id
      and existing.component_name = c.component_name
 )
on conflict (price_fact_id, component_name) do nothing;

delete from price_fact_daily p
 using price_fact_merge m
 where p.price_fact_id = m.duplicate_id;

alter table price_fact_daily drop constraint if exists price_fact_daily_unique;

create unique index if not exists price_fact_geo_only_uq
  on price_fact_daily (source_id, geography_id, fuel_id, applicable_date, price_kind)
  where outlet_id is null and geography_id is not null;

create unique index if not exists price_fact_outlet_only_uq
  on price_fact_daily (source_id, outlet_id, fuel_id, applicable_date, price_kind)
  where outlet_id is not null and geography_id is null;

create unique index if not exists price_fact_outlet_geo_uq
  on price_fact_daily (source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind)
  where outlet_id is not null and geography_id is not null;

alter table crawl_run add column if not exists records_rejected integer not null default 0;

alter table source_artifact drop constraint if exists source_artifact_source_id_content_hash_key;
create unique index if not exists source_artifact_capture_uq
  on source_artifact (crawl_run_id, content_hash, coalesce(original_url, ''));

create table if not exists price_fact_evidence (
  price_fact_id bigint not null references price_fact_daily(price_fact_id) on delete cascade,
  artifact_id bigint not null references source_artifact(artifact_id) on delete restrict,
  parser_version text not null,
  primary_evidence boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (price_fact_id, artifact_id)
);

create table if not exists data_generation (
  namespace text primary key,
  generation bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into data_generation (namespace, generation)
values ('prices', 1)
on conflict (namespace) do nothing;

create table if not exists ingestion_job (
  ingestion_job_id bigserial primary key,
  source_id bigint not null references source_catalog(source_id),
  crawl_run_id bigint references crawl_run(crawl_run_id),
  run_mode text not null check (run_mode in ('manual', 'scheduled')),
  run_kind text not null default 'full',
  scheduled_for timestamptz,
  reason text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ingestion_job_scheduled_slot_uq
  on ingestion_job (source_id, run_kind, scheduled_for)
  where scheduled_for is not null;

create index if not exists ingestion_job_claim_idx
  on ingestion_job (status, available_at, created_at);
