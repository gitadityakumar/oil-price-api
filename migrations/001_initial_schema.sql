-- 001_initial_schema.sql
-- Core warehouse schema for the Indian Fuel Price API.
-- All tables use IF NOT EXISTS so re-applying is safe.

create table if not exists source_catalog (
  source_id bigserial primary key,
  source_key text unique not null,
  source_name text not null,
  source_type text not null check (source_type in ('ppac','omc','cgd','regulator','aggregator','exchange','internal')),
  operator_name text,
  canonical_url text not null,
  terms_summary text,
  commercial_use_allowed boolean,
  reliability_tier text not null check (reliability_tier in ('highest','high','medium','low')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists geography_dim (
  geography_id bigserial primary key,
  country_code text not null default 'IN',
  state_name text,
  state_code text,
  district_name text,
  city_name text,
  area_name text,
  pincode text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  geometry_ref text,
  canonical_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists geography_dim_pin_idx on geography_dim (pincode);
create index if not exists geography_dim_city_state_idx on geography_dim (lower(city_name), lower(state_name));
create index if not exists geography_dim_state_idx on geography_dim (lower(state_name));

create table if not exists outlet_dim (
  outlet_id bigserial primary key,
  source_id bigint references source_catalog(source_id),
  operator_name text,
  outlet_name text,
  dealer_code text,
  address_text text,
  pincode text,
  city_name text,
  state_name text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  fuel_station_type text not null check (fuel_station_type in ('ro','cng_station','lng_station','png_tariff_area','unknown')) default 'unknown',
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outlet_dim_pin_idx on outlet_dim (pincode);
create index if not exists outlet_dim_city_state_idx on outlet_dim (lower(city_name), lower(state_name));
create index if not exists outlet_dim_dealer_code_idx on outlet_dim (dealer_code);

create table if not exists fuel_dim (
  fuel_id bigserial primary key,
  fuel_code text unique not null check (fuel_code in ('PETROL','DIESEL','CNG','PNG','LNG','LPG')),
  display_name text not null,
  retail_unit text not null check (retail_unit in ('LTR','KG','SCM','CYLINDER')),
  active boolean not null default true
);

create table if not exists price_fact_daily (
  price_fact_id bigserial primary key,
  public_id text unique not null,
  source_id bigint not null references source_catalog(source_id),
  outlet_id bigint references outlet_dim(outlet_id),
  geography_id bigint references geography_dim(geography_id),
  fuel_id bigint not null references fuel_dim(fuel_id),
  applicable_date date not null,
  effective_at timestamptz,
  observed_at timestamptz not null,
  price_value numeric(12,4) not null check (price_value >= 0),
  currency_code text not null default 'INR',
  price_kind text not null check (price_kind in ('retail','breakup_final','tax_exclusive','wholesale_context')),
  confidence_score numeric(5,2) check (confidence_score >= 0 and confidence_score <= 1),
  raw_document_url text,
  raw_hash text,
  attribution_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_fact_has_location check (outlet_id is not null or geography_id is not null),
  constraint price_fact_daily_unique unique (source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind)
);

create index if not exists price_fact_daily_public_idx on price_fact_daily (public_id);
create index if not exists price_fact_daily_lookup_idx on price_fact_daily (fuel_id, applicable_date, geography_id, outlet_id);
create index if not exists price_fact_daily_observed_idx on price_fact_daily (observed_at desc);

create table if not exists price_component_fact (
  component_id bigserial primary key,
  price_fact_id bigint not null references price_fact_daily(price_fact_id) on delete cascade,
  component_name text not null,
  component_value numeric(12,4),
  component_unit text,
  created_at timestamptz not null default now(),
  unique (price_fact_id, component_name)
);

create table if not exists pincode_resolution (
  resolution_id bigserial primary key,
  pincode text not null,
  geography_id bigint references geography_dim(geography_id),
  outlet_id bigint references outlet_dim(outlet_id),
  resolution_method text not null check (resolution_method in ('direct_station_pin','nearest_station_geo','tariff_area_mapping','city_fallback')),
  priority_rank int not null check (priority_rank > 0),
  confidence_modifier numeric(5,2) not null default 1.0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pincode_resolution_target check (geography_id is not null or outlet_id is not null)
);

create index if not exists pincode_resolution_pin_priority_idx on pincode_resolution (pincode, priority_rank);

create table if not exists crawl_run (
  crawl_run_id bigserial primary key,
  source_id bigint not null references source_catalog(source_id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('started','success','partial','failed','skipped')),
  http_status int,
  records_seen int not null default 0,
  records_written int not null default 0,
  notes text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists crawl_run_source_started_idx on crawl_run (source_id, started_at desc);

create table if not exists source_artifact (
  artifact_id bigserial primary key,
  source_id bigint not null references source_catalog(source_id),
  crawl_run_id bigint references crawl_run(crawl_run_id),
  artifact_type text not null check (artifact_type in ('html','pdf','xlsx','csv','json','other')),
  original_url text,
  storage_uri text not null,
  content_hash text not null,
  captured_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  unique (source_id, content_hash)
);

create table if not exists api_client (
  api_client_id bigserial primary key,
  client_id text unique not null,
  name text not null,
  key_hash text not null,
  status text not null check (status in ('active','disabled','revoked')) default 'active',
  tier text not null default 'free',
  rate_limit_per_minute int not null default 60,
  quota_per_day int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists api_usage_daily (
  usage_date date not null,
  api_client_id bigint not null references api_client(api_client_id),
  request_count bigint not null default 0,
  primary key (usage_date, api_client_id)
);