/**
 * Station output schema mappers.
 */

import type { OutletRow } from './stations.model';
import type { FuelStationType } from './stations.model';

export interface StationLocationSchema {
  pincode: string | null;
  city_name: string | null;
  state_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface StationSchema {
  id: string;
  operator_name: string | null;
  name: string | null;
  dealer_code: string | null;
  type: FuelStationType;
  address: string | null;
  location: StationLocationSchema;
  fuels: string[];
  source: { id: string; name: string | null };
  links: { prices: string };
}

export function mapStation(row: OutletRow): StationSchema {
  return {
    id: row.public_id,
    operator_name: row.operator_name,
    name: row.outlet_name,
    dealer_code: row.dealer_code,
    type: row.fuel_station_type,
    address: row.address_text,
    location: {
      pincode: row.pincode,
      city_name: row.city_name,
      state_name: row.state_name,
      latitude: row.latitude !== null ? toNumber(row.latitude) : null,
      longitude: row.longitude !== null ? toNumber(row.longitude) : null,
    },
    fuels: row.fuels ?? [],
    source: {
      id: row.source_key ? `src_${row.source_key}` : 'src_unknown',
      name: row.source_name,
    },
    links: { prices: `/v1/stations/${row.public_id}/prices` },
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}