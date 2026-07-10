-- 900_fixture_seed.sql
-- Dev/test fixture data for the price read API: a geography row, an outlet, a
-- pincode_resolution entry, and a couple of price facts with components.
-- Idempotent via ON CONFLICT; loaded only by the explicit fixture command.

update source_catalog
   set rights_status = 'approved',
       commercial_use_allowed = true,
       public_display_enabled = true,
       ingestion_enabled = true
 where source_key in ('ppac_rsp', 'iocl_retail', 'bpcl_retail', 'igl_prices');

insert into geography_dim (geography_id, country_code, state_name, state_code, district_name, city_name, area_name, pincode, latitude, longitude, canonical_label)
values (1001, 'IN', 'Delhi', 'DL', 'New Delhi', 'Delhi', 'Connaught Place', '110001', 28.6315000, 77.2167000, 'Connaught Place, Delhi, DL 110001')
on conflict (geography_id) do update set
  canonical_label = excluded.canonical_label,
  pincode = excluded.pincode,
  city_name = excluded.city_name,
  state_name = excluded.state_name,
  state_code = excluded.state_code;

insert into outlet_dim (outlet_id, public_id, source_id, operator_name, outlet_name, dealer_code, address_text, pincode, city_name, state_name, latitude, longitude, fuel_station_type, metadata_json, active)
select 9001, 'outlet_example', s.source_id, 'IndianOil', 'Example Fuel Station', '123456', 'Connaught Place, New Delhi', '110001', 'Delhi', 'Delhi', 28.6315000, 77.2167000, 'ro', '{}'::jsonb, true
  from source_catalog s where s.source_key = 'iocl_retail'
on conflict (outlet_id) do update set
  public_id = excluded.public_id,
  operator_name = excluded.operator_name,
  outlet_name = excluded.outlet_name,
  pincode = excluded.pincode;

insert into pincode_resolution (resolution_id, pincode, geography_id, outlet_id, resolution_method, priority_rank, confidence_modifier, active)
values (5001, '110001', 1001, 9001, 'direct_station_pin', 1, 1.00, true)
on conflict (resolution_id) do nothing;

insert into pincode_resolution (resolution_id, pincode, geography_id, outlet_id, resolution_method, priority_rank, confidence_modifier, active)
values (5002, '110001', 1001, null, 'city_fallback', 4, 0.80, true)
on conflict (resolution_id) do nothing;

insert into price_fact_daily (price_fact_id, public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
select 7001, 'price_example', s.source_id, null, 1001, f.fuel_id, '2026-07-09', '2026-07-09T00:30:00.000Z', '2026-07-09T00:47:00.000Z', 96.72, 'INR', 'retail', 0.88, null, 'sha256:example', 'Price normalized from official publication.'
  from source_catalog s, fuel_dim f
 where s.source_key = 'ppac_rsp' and f.fuel_code = 'PETROL'
on conflict (price_fact_id) do update set
  price_value = excluded.price_value,
  observed_at = excluded.observed_at,
  confidence_score = excluded.confidence_score;

insert into price_fact_daily (price_fact_id, public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
select 7002, 'price_example_diesel', s.source_id, null, 1001, f.fuel_id, '2026-07-09', '2026-07-09T00:30:00.000Z', '2026-07-09T00:47:00.000Z', 89.54, 'INR', 'retail', 0.88, null, 'sha256:example2', 'Price normalized from official publication.'
  from source_catalog s, fuel_dim f
 where s.source_key = 'ppac_rsp' and f.fuel_code = 'DIESEL'
on conflict (price_fact_id) do update set
  price_value = excluded.price_value,
  observed_at = excluded.observed_at;

-- Outlet-level price so outlet_id selectors resolve direct.
insert into price_fact_daily (price_fact_id, public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
select 7003, 'price_outlet_petrol', s.source_id, 9001, null, f.fuel_id, '2026-07-09', '2026-07-09T00:30:00.000Z', '2026-07-09T00:50:00.000Z', 97.10, 'INR', 'retail', 0.90, null, 'sha256:outlet', 'Outlet price from locator.'
  from source_catalog s, fuel_dim f
 where s.source_key = 'iocl_retail' and f.fuel_code = 'PETROL'
on conflict (price_fact_id) do update set
  price_value = excluded.price_value,
  observed_at = excluded.observed_at;

-- Competing duplicate geography row (lower confidence) to exercise ranking.
insert into price_fact_daily (price_fact_id, public_id, source_id, outlet_id, geography_id, fuel_id, applicable_date, effective_at, observed_at, price_value, currency_code, price_kind, confidence_score, raw_document_url, raw_hash, attribution_text)
select 7004, 'price_example_alt', s.source_id, null, 1001, f.fuel_id, '2026-07-09', '2026-07-09T00:30:00.000Z', '2026-07-09T00:30:00.000Z', 96.50, 'INR', 'retail', 0.60, null, 'sha256:alt', 'Lower-confidence duplicate.'
  from source_catalog s, fuel_dim f
 where s.source_key = 'bpcl_retail' and f.fuel_code = 'PETROL'
on conflict (price_fact_id) do update set
  price_value = excluded.price_value,
  confidence_score = excluded.confidence_score;

insert into price_component_fact (component_id, price_fact_id, component_name, component_value, component_unit)
values
  (8001, 7001, 'base_price',        57.35, 'INR/LTR'),
  (8002, 7001, 'excise',            19.90, 'INR/LTR'),
  (8003, 7001, 'vat',               15.71, 'INR/LTR'),
  (8004, 7001, 'dealer_commission',  3.76, 'INR/LTR')
on conflict (component_id) do nothing;

insert into crawl_run (crawl_run_id, source_id, started_at, finished_at, status, http_status, records_seen, records_written, notes)
select 6001, s.source_id, '2026-07-09T00:45:00.000Z', '2026-07-09T00:46:00.000Z', 'success', 200, 2, 2, 'fixture successful crawl'
  from source_catalog s where s.source_key = 'ppac_rsp'
on conflict (crawl_run_id) do nothing;

insert into crawl_run (crawl_run_id, source_id, started_at, finished_at, status, http_status, records_seen, records_written, notes)
select 6002, s.source_id, '2026-07-09T00:50:00.000Z', '2026-07-09T00:51:00.000Z', 'success', 200, 1, 1, 'fixture outlet crawl'
  from source_catalog s where s.source_key = 'iocl_retail'
on conflict (crawl_run_id) do nothing;

-- Force the sequence past inserted ids so re-runs do not collide.
select setval(pg_get_serial_sequence('price_fact_daily','price_fact_id'), greatest(9000, (select coalesce(max(price_fact_id),0) from price_fact_daily)));
select setval(pg_get_serial_sequence('outlet_dim','outlet_id'),         greatest(9999, (select coalesce(max(outlet_id),0) from outlet_dim)));
select setval(pg_get_serial_sequence('geography_dim','geography_id'),   greatest(9999, (select coalesce(max(geography_id),0) from geography_dim)));
select setval(pg_get_serial_sequence('pincode_resolution','resolution_id'), greatest(9999, (select coalesce(max(resolution_id),0) from pincode_resolution)));
select setval(pg_get_serial_sequence('price_component_fact','component_id'), greatest(9999, (select coalesce(max(component_id),0) from price_component_fact)));
select setval(pg_get_serial_sequence('crawl_run','crawl_run_id'), greatest(9999, (select coalesce(max(crawl_run_id),0) from crawl_run)));
