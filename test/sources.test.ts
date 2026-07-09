import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSource } from '../src/modules/sources/source.schema';
import { evaluateStaleness } from '../src/core/observability/staleness-alerts';

test('task10 sources: source mapping and staleness states', () => {
  const source = mapSource({
    source_id: 1,
    source_key: 'ppac_rsp',
    source_name: 'PPAC RSP Archive',
    source_type: 'ppac',
    operator_name: null,
    canonical_url: 'https://example.test',
    terms_summary: null,
    commercial_use_allowed: true,
    reliability_tier: 'highest',
    active: true,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    last_successful_crawl_at: '2026-07-09T00:00:00.000Z',
    last_observed_price_at: '2026-07-09T00:00:00.000Z',
  });
  assert.equal(source.id, 'src_ppac_rsp');
  assert.equal(evaluateStaleness({
    source_key: 'ppac_rsp',
    last_successful_crawl_at: '2026-07-09T00:00:00.000Z',
    expected_cadence_minutes: 60,
  }, new Date('2026-07-09T00:30:00.000Z')), 'fresh');
});
