/**
 * Station read API domain types — lookup inputs and result shapes consumed by
 * the station service and controller. SQL rows live in stations.model.ts; HTTP
 * schemas in station.schema.ts.
 */

import type { FuelCode } from '../prices/prices.model';
import type { StationSchema } from './station.schema';

export interface StationFilters {
  pin?: string;
  city?: string;
  state?: string;
  fuel?: FuelCode;
  operator?: string;
  limit: number;
  offset: number;
}

export interface StationListResult {
  stations: StationSchema[];
  total: number;
}

export interface StationPricesInput {
  outletPublicId: string;
  fuels: FuelCode[];
  date: string;
  includes: string[];
  limit: number;
  offset: number;
}