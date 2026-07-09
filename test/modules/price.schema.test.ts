import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapPrice, mapPriceComponents, mapFuel, computeFreshnessBadge } from '../../src/modules/prices/price.schema';
import type { PriceFactWithProvenance, PriceComponentRow } from '../../src/modules/prices/prices.model';

const basePrice: PriceFactWithProvenance = {
  price_fact_id: 1,
  public_id: 'price_example',
  source_id: 1,
  source_key: 'ppac_rsp',
  source_name: 'PPAC RSP Archive',
  source_type: 'ppac',
  operator_name: null,
  reliability_tier: 'highest',
  outlet_id: null,
  geography_id: 5,
  fuel_id: 1,
  fuel_code: 'PETROL',
  fuel_display_name: 'Petrol',
  fuel_retail_unit: 'LTR',
  applicable_date: '2026-07-09',
  effective_at: '2026-07-09T00:30:00.000Z',
  observed_at: '2026-07-09T00:47:00.000Z',
  price_value: '96.72',
  currency_code: 'INR',
  price_kind: 'retail',
  confidence_score: '0.88',
  raw_document_url: null,
  raw_hash: 'sha256:example',
  attribution_text: 'Price normalized from official publication.',
  created_at: '2026-07-09T00:50:00.000Z',
  updated_at: '2026-07-09T00:50:00.000Z',
  outlet_public_id: null,
  geo: {
    geography_id: 5,
    country_code: 'IN',
    state_name: 'Delhi',
    state_code: 'DL',
    district_name: 'New Delhi',
    city_name: 'Delhi',
    area_name: 'Connaught Place',
    pincode: '110001',
    canonical_label: 'Connaught Place, Delhi, DL 110001',
  },
  pin_resolution: {
    pincode: '110001',
    method: 'city_fallback',
    priority_rank: 4,
    direct_from_source: false,
    derived: true,
    input_type: 'pin',
    input_value: '110001',
    geography_id: 5,
    outlet_id: null,
  },
};

test('mapFuel: shape', () => {
  assert.deepEqual(mapFuel({ fuel_code: 'PETROL', display_name: 'Petrol', retail_unit: 'LTR' }), {
    code: 'PETROL', label: 'Petrol', unit: 'LTR',
  });
});

test('mapPrice: produces contract shape', () => {
  const p = mapPrice(basePrice);
  assert.equal(p.id, 'price_example');
  assert.equal(p.fuel.code, 'PETROL');
  assert.equal(p.price.value, 96.72);
  assert.equal(p.price.currency, 'INR');
  assert.equal(p.price.unit, 'LTR');
  assert.equal(p.price.kind, 'retail');
  assert.equal(p.location?.pincode, '110001');
  assert.equal(p.location?.resolution?.method, 'city_fallback');
  assert.equal(p.location?.resolution?.derived, true);
  assert.equal(p.outlet, null);
  assert.equal(p.source.id, 'src_ppac_rsp');
  assert.equal(p.source.reliability_tier, 'highest');
  assert.equal(p.provenance.confidence_score, 0.88);
  assert.equal(p.provenance.raw_hash, 'sha256:example');
  assert.equal(p.links.components, '/v1/prices/price_example/components');
});

test('mapPrice: outlet shape when public_id present', () => {
  const p = mapPrice({ ...basePrice, outlet_public_id: 'outlet_x', operator_name: 'IndianOil' });
  assert.equal(p.outlet?.id, 'outlet_x');
  assert.equal(p.outlet?.operator_name, 'IndianOil');
});

test('mapPrice: location null when geo absent', () => {
  const p = mapPrice({ ...basePrice, geo: null, pin_resolution: null });
  assert.equal(p.location, null);
});

test('computeFreshnessBadge: today', () => {
  const now = new Date().toISOString();
  assert.match(computeFreshnessBadge(now), /today/);
});

test('mapPriceComponents: shape', () => {
  const components: PriceComponentRow[] = [
    { component_id: 1, price_fact_id: 1, component_name: 'base_price', component_value: '57.35', component_unit: 'INR/LTR', created_at: 'x' },
    { component_id: 2, price_fact_id: 1, component_name: 'excise', component_value: '19.9', component_unit: 'INR/LTR', created_at: 'x' },
  ];
  const out = mapPriceComponents(basePrice, components);
  assert.equal(out.price_id, 'price_example');
  assert.equal(out.components.length, 2);
  assert.equal(out.components[0].value, 57.35);
  assert.equal(out.source.id, 'src_ppac_rsp');
  assert.equal(out.provenance.raw_hash, 'sha256:example');
});