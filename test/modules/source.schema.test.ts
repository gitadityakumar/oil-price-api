import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSource } from '../../src/modules/sources/source.schema';
import type { SourceCatalogRow } from '../../src/modules/sources/sources.model';

const src: SourceCatalogRow = {
  source_id: 5,
  source_key: 'igl_prices',
  source_name: 'IGL Prices',
  source_type: 'cgd',
  operator_name: 'Indraprastha Gas Limited',
  canonical_url: 'https://www.iglonline.net/cng-png-prices',
  terms_summary: null,
  commercial_use_allowed: null,
  reliability_tier: 'high',
  active: true,
  created_at: 'x',
  updated_at: 'x',
  last_successful_crawl_at: '2026-07-09T00:45:00.000Z',
  last_observed_price_at: '2026-07-09T00:45:00.000Z',
};

test('mapSource: contract shape', () => {
  const s = mapSource(src);
  assert.equal(s.id, 'src_igl_prices');
  assert.equal(s.key, 'igl_prices');
  assert.equal(s.type, 'cgd');
  assert.equal(s.reliability_tier, 'high');
  assert.equal(s.last_successful_crawl_at, '2026-07-09T00:45:00.000Z');
  assert.equal(s.commercial_use_allowed, null);
});