insert into source_catalog (source_key, source_name, source_type, operator_name, canonical_url, terms_summary, commercial_use_allowed, reliability_tier, active) values
  ('ppac_tax_reference',  'PPAC Tax Reference',     'ppac',      'Petroleum Planning & Analysis Cell', 'https://ppac.gov.in/', 'Tax normalization context only; not a direct public retail display source.', false, 'high', true),
  ('igx_wholesale_context','IGX Wholesale Context', 'exchange',  'Indian Gas Exchange',                'https://www.igxindia.com/', 'Wholesale context only; never mix into retail price responses.', false, 'medium', true)
on conflict (source_key) do update set
  source_name = excluded.source_name,
  source_type = excluded.source_type,
  operator_name = excluded.operator_name,
  canonical_url = excluded.canonical_url,
  terms_summary = excluded.terms_summary,
  commercial_use_allowed = excluded.commercial_use_allowed,
  reliability_tier = excluded.reliability_tier,
  active = excluded.active,
  updated_at = now();
