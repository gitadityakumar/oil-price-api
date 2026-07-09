-- 003_outlet_public_id.sql
-- Add a public, opaque outlet id used by the read API and PIN/outlet selectors.
-- The internal bigint outlet_id remains the primary key; public_id is the
-- value exposed in /v1/stations and /v1/prices?outlet_id=.

alter table outlet_dim add column if not exists public_id text;

-- Backfill any existing rows with a stable default.
update outlet_dim
   set public_id = 'outlet_' || outlet_id::text
 where public_id is null;

-- Enforce uniqueness and non-nullability going forward.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'outlet_dim_public_id_key'
  ) then
    alter table outlet_dim add constraint outlet_dim_public_id_key unique (public_id);
  end if;
end$$;

alter table outlet_dim alter column public_id set not null;

create index if not exists outlet_dim_public_id_idx on outlet_dim (public_id);