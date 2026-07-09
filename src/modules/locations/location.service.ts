/**
 * Location service. Resolves location selectors into candidate targets with
 * warnings. No HTTP knowledge; consumed by the price service.
 */

import { resolveTargets } from './location.repository';
import type { LocationInput } from '../prices/price.model';
import type { LocationResolution, ResolvedTarget } from './location.model';
import type { Warning } from '../prices/price.model';

export class LocationService {
  async resolve(input: LocationInput): Promise<LocationResolution> {
    const candidates = await resolveTargets(input);
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