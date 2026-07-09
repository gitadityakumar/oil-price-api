/**
 * Station service — business logic only. No HTTP types.
 */

import { findStations, findStationByPublicId, countStations } from './station.repository';
import { mapStation } from './station.schema';
import { AppError } from '../../core/errors/app-error';
import type { StationFilters, StationListResult } from './station.model';
import type { StationSchema } from './station.schema';

export class StationService {
  async listStations(filters: StationFilters): Promise<StationListResult> {
    const rows = await findStations({
      pin: filters.pin,
      city: filters.city,
      state: filters.state,
      fuel: filters.fuel,
      operator: filters.operator,
      limit: filters.limit,
      offset: filters.offset,
    });
    const total = await countStations({
      pin: filters.pin,
      city: filters.city,
      state: filters.state,
      fuel: filters.fuel,
      operator: filters.operator,
    });
    return { stations: rows.map(mapStation), total };
  }

  async getStation(publicId: string): Promise<StationSchema> {
    const row = await findStationByPublicId(publicId);
    if (!row || !row.active) {
      throw new AppError('NOT_FOUND', `Station not found: ${publicId}`, 404);
    }
    return mapStation(row);
  }
}