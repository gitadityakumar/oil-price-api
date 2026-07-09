/**
 * Coverage service — business logic only. No HTTP types.
 */

import { findCoverage, isAllowedSourceType } from './coverage.repository';
import { AppError } from '../../core/errors/app-error';
import type { CoverageFilters, CoverageRow } from './coverage.model';

const ALLOWED_FUELS = new Set(['PETROL', 'DIESEL', 'CNG', 'PNG', 'LNG', 'LPG']);

export class CoverageService {
  async getCoverage(filters: CoverageFilters): Promise<CoverageRow[]> {
    if (filters.fuel) {
      const upper = filters.fuel.toUpperCase();
      if (!ALLOWED_FUELS.has(upper)) {
        throw new AppError('VALIDATION_ERROR', `Invalid fuel: ${filters.fuel}`, 400, [{ field: 'fuel', reason: 'Not allowed.' }]);
      }
      filters = { ...filters, fuel: upper };
    }
    if (filters.source_type && !isAllowedSourceType(filters.source_type)) {
      throw new AppError('VALIDATION_ERROR', `Invalid source_type: ${filters.source_type}`, 400, [{ field: 'source_type', reason: 'Not allowed.' }]);
    }
    return findCoverage(filters);
  }
}