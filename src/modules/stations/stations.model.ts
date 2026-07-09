/**
 * Station (outlet) module domain + persistence types.
 */

export type FuelStationType = 'ro' | 'cng_station' | 'lng_station' | 'png_tariff_area' | 'unknown';

export type OutletRow = {
  outlet_id: number;
  source_id: number | null;
  operator_name: string | null;
  outlet_name: string | null;
  dealer_code: string | null;
  address_text: string | null;
  pincode: string | null;
  city_name: string | null;
  state_name: string | null;
  latitude: string | null;
  longitude: string | null;
  fuel_station_type: FuelStationType;
  metadata_json: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};