import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfidenceService } from '../src/modules/locations/confidence.service';
import { FreshnessService } from '../src/modules/locations/freshness.service';
import { priceKindRank, reliabilityRank, resolutionRank } from '../src/modules/prices/price.model';

test('task10 prices: ranking, confidence, and freshness helpers', () => {
  assert.ok(reliabilityRank('highest') < reliabilityRank('low'));
  assert.ok(resolutionRank('direct_station_pin') < resolutionRank('city_fallback'));
  assert.ok(priceKindRank('retail') < priceKindRank('tax_exclusive'));

  const now = new Date('2026-07-09T02:00:00.000Z');
  const score = new ConfidenceService().score({
    reliabilityTier: 'highest',
    method: 'direct_station_pin',
    applicableDate: '2026-07-09',
    observedAt: '2026-07-09T01:00:00.000Z',
    hasComponents: true,
    now,
  });
  assert.ok(score > 0.9);

  const badge = new FreshnessService().buildBadge({
    sourceType: 'ppac',
    reliabilityTier: 'highest',
    applicableDate: '2026-07-09',
    effectiveAt: null,
    observedAt: '2026-07-09T01:00:00.000Z',
    now,
  });
  assert.match(badge, /official source/);
});
