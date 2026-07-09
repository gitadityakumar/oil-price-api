import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapStation } from '../src/modules/stations/station.schema';

test('task10 stations: output schema maps public station fields', () => {
  const station = mapStation({
    outlet_id: 1,
    public_id: 'outlet_example',
    source_id: 1,
    source_key: 'iocl_retail',
    source_name: 'IOCL Retail Locator',
    operator_name: 'IndianOil',
    outlet_name: 'Example Fuel Station',
    dealer_code: '123456',
    address_text: 'Connaught Place',
    pincode: '110001',
    city_name: 'Delhi',
    state_name: 'Delhi',
    latitude: '28.6315000',
    longitude: '77.2167000',
    fuel_station_type: 'ro',
    metadata_json: {},
    active: true,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    fuels: ['PETROL'],
  });
  assert.equal(station.id, 'outlet_example');
  assert.equal(station.links.prices, '/v1/stations/outlet_example/prices');
  assert.deepEqual(station.fuels, ['PETROL']);
});
