import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapStation } from '../../src/modules/stations/station.schema';
import type { OutletRow } from '../../src/modules/stations/stations.model';

const outlet: OutletRow = {
  outlet_id: 1,
  public_id: 'outlet_example',
  source_id: 2,
  source_key: 'iocl_retail',
  source_name: 'IOCL Retail Locator',
  operator_name: 'IndianOil',
  outlet_name: 'Example Fuel Station',
  dealer_code: '123456',
  address_text: 'Connaught Place, New Delhi',
  pincode: '110001',
  city_name: 'Delhi',
  state_name: 'Delhi',
  latitude: '28.6315',
  longitude: '77.2167',
  fuel_station_type: 'ro',
  metadata_json: {},
  fuels: ['PETROL', 'DIESEL', 'CNG'],
  active: true,
  created_at: 'x',
  updated_at: 'x',
};

test('mapStation: contract shape', () => {
  const s = mapStation(outlet);
  assert.equal(s.id, 'outlet_example');
  assert.equal(s.operator_name, 'IndianOil');
  assert.equal(s.type, 'ro');
  assert.equal(s.location.pincode, '110001');
  assert.equal(s.location.latitude, 28.6315);
  assert.deepEqual(s.fuels, ['PETROL', 'DIESEL', 'CNG']);
  assert.equal(s.source.id, 'src_iocl_retail');
  assert.equal(s.links.prices, '/v1/stations/outlet_example/prices');
});

test('mapStation: null geo coords stay null', () => {
  const s = mapStation({ ...outlet, latitude: null, longitude: null });
  assert.equal(s.location.latitude, null);
  assert.equal(s.location.longitude, null);
});

test('mapStation: missing source key uses src_unknown', () => {
  const s = mapStation({ ...outlet, source_key: null, source_name: null });
  assert.equal(s.source.id, 'src_unknown');
  assert.equal(s.source.name, null);
});