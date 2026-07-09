/**
 * Location service. Resolves location selectors into candidate targets with
 * warnings. No HTTP knowledge; consumed by the price service.
 */

import { resolveTargets } from './location.repository';
import { PincodeResolutionService } from './pincode-resolution.service';
import type { LocationInput } from '../prices/price.model';
import type { LocationResolution, ResolvedTarget, ResolvedLocationTarget } from './location.model';
import type { Warning } from '../prices/price.model';

export class LocationService {
  constructor(private readonly pincodeResolution = new PincodeResolutionService()) {}

  async resolve(input: LocationInput): Promise<LocationResolution> {
    const candidates = input.type === 'pin'
      ? flattenPinTargets(await this.pincodeResolution.resolvePin(input.pin))
      : await resolveTargets(input);
    const warnings: Warning[] = [];
    if (candidates.length === 0) {
      warnings.push({
        code: 'NO_RESOLUTION',
        message: `No matching geography or outlet found for the requested ${input.type} selector.`,
      });
    }
    return { input, candidates, warnings };
  }

  /** First-candidate shortcut; services that only need the best target. */
  async bestCandidate(input: LocationInput): Promise<ResolvedTarget | null> {
    const { candidates } = await this.resolve(input);
    return candidates[0] ?? null;
  }
}

function flattenPinTargets(targets: ResolvedLocationTarget[]): ResolvedTarget[] {
  const out: ResolvedTarget[] = [];
  for (const target of targets) {
    for (const outletId of target.outletIds) {
      out.push({
        geography_id: target.geographyIds[0] ?? null,
        outlet_id: outletId,
        resolution_method: target.method,
        priority_rank: target.priorityRank,
        direct_from_source: target.directFromSource,
        derived: target.derived,
      });
    }
    for (const geographyId of target.geographyIds) {
      if (target.outletIds.length > 0 && target.method === 'direct_station_pin') continue;
      out.push({
        geography_id: geographyId,
        outlet_id: null,
        resolution_method: target.method,
        priority_rank: target.priorityRank,
        direct_from_source: target.directFromSource,
        derived: target.derived,
      });
    }
  }
  return out;
}
