import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapGeography, mapPincodeResolution } from '../../src/modules/locations/location.schema';
import type { GeographyRow, PincodeResolutionRow } from '../../src/modules/locations/locations.model';

const geo: GeographyRow = {
  geography_id: 5,
  country_code: 'IN',
  state_name: 'Delhi',
  state_code: 'DL',
  district_name: 'New Delhi',
  city_name: 'Delhi',
  area_name: 'Connaught Place',
  pincode: '110001',
  latitude: '28.6315',
  longitude: '77.2167',
  geometry_ref: null,
  canonical_label: 'Connaught Place, Delhi, DL 110001',
  created_at: 'x',
  updated_at: 'x',
};

test('mapGeography: contract shape with numeric lat/lon', () => {
  const g = mapGeography(geo);
  assert.equal(g.country_code, 'IN');
  assert.equal(g.state_code, 'DL');
  assert.equal(g.latitude, 28.6315);
  assert.equal(g.longitude, 77.2167);
});

test('mapGeography: null coords stay null', () => {
  const g = mapGeography({ ...geo, latitude: null, longitude: null });
  assert.equal(g.latitude, null);
  assert.equal(g.longitude, null);
});

const res: PincodeResolutionRow = {
  resolution_id: 1,
  pincode: '110001',
  geography_id: 5,
  outlet_id: null,
  resolution_method: 'city_fallback',
  priority_rank: 4,
  confidence_modifier: '0.9',
  active: true,
  created_at: 'x',
  updated_at: 'x',
};

test('mapPincodeResolution: contract shape', () => {
  const r = mapPincodeResolution(res);
  assert.equal(r.pincode, '110001');
  assert.equal(r.method, 'city_fallback');
  assert.equal(r.priority_rank, 4);
  assert.equal(r.confidence_modifier, 0.9);
});