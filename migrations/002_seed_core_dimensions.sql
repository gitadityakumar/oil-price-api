-- 002_seed_core_dimensions.sql
-- Idempotent seeds for fuel_dim and source_catalog.
-- Re-running is safe via ON CONFLICT DO UPDATE.

insert into fuel_dim (fuel_code, display_name, retail_unit) values
  ('PETROL', 'Petrol', 'LTR'),
  ('DIESEL', 'Diesel', 'LTR'),
  ('CNG',    'CNG',    'KG'),
  ('PNG',    'PNG',    'SCM'),
  ('LNG',    'LNG',    'KG'),
  ('LPG',    'LPG',    'CYLINDER')
on conflict (fuel_code) do update set
  display_name = excluded.display_name,
  retail_unit = excluded.retail_unit;

insert into source_catalog (source_key, source_name, source_type, operator_name, canonical_url, terms_summary, commercial_use_allowed, reliability_tier, active) values
  ('ppac_rsp',            'PPAC RSP Archive',          'ppac',      'Petroleum Planning & Analysis Cell', 'https://ppac.gov.in/',                 'Official government RSP archive; public sector reference data.',    true,  'highest', true),
  ('iocl_retail',         'Indian Oil Retail Prices',  'omc',       'Indian Oil Corporation Ltd',         'https://iocl.com/',                    'OMC public price and locator surfaces.',                            true,  'highest', true),
  ('bpcl_retail',         'BPCL Retail Prices',        'omc',       'Bharat Petroleum Corporation Ltd',  'https://www.bpcl.in/',                  'OMC petro-prices and locator.',                                     true,  'highest', true),
  ('hpcl_retail',         'HPCL Retail Prices',        'omc',       'Hindustan Petroleum Corporation Ltd','https://www.hindustanpetroleum.com/',  'OMC price buildup / RSP map.',                                       true,  'highest', true),
  ('igl_prices',          'Indraprastha Gas Limited',  'cgd',       'Indraprastha Gas Ltd',               'https://www.igl.co.in/',               'CGD current and chronology CNG/PNG rate cards.',                    true,  'high',    true),
  ('gujarat_gas_prices',  'Gujarat Gas Prices',       'cgd',       'Gujarat Gas Ltd',                    'https://www.gujaratgas.com/',           'CGD area-wise CNG/PNG prices.',                                     true,  'high',    true),
  ('mgl_prices',          'Mahanagar Gas Limited',    'cgd',       'Mahanagar Gas Ltd',                 'https://www.mngl.org/',                 'CGD Mumbai rate cards.',                                            true,  'high',    true),
  ('mngl_prices',         'MNGL Prices',              'cgd',       'Mahanagar Natural Gas Ltd',          'https://www.mngl.org/',                 'CGD current and history pages.',                                    true,  'high',    true),
  ('cugl_prices',         'CUGL Prices',              'cgd',       'Central U.P. Gas Ltd',               'https://www.cugl.in/',                  'CGD CNG/PNG/city nodes.',                                           true,  'high',    true),
  ('pngrb_reference',     'PNGRB Reference',          'regulator', 'Petroleum & Natural Gas Regulatory Board','https://pngrb.gov.in/',          'Regulator reference; validation only, not commercial display.',     false, 'high',    true)
on conflict (source_key) do update set
  source_name           = excluded.source_name,
  source_type           = excluded.source_type,
  operator_name         = excluded.operator_name,
  canonical_url         = excluded.canonical_url,
  terms_summary         = excluded.terms_summary,
  commercial_use_allowed = excluded.commercial_use_allowed,
  reliability_tier      = excluded.reliability_tier,
  active                = excluded.active,
  updated_at            = now();