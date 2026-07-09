/**
 * Coverage read API domain types.
 */

export interface CoverageFilters {
  fuel?: string;
  state?: string;
  source_type?: string;
}

export interface CoverageRow {
  state_name: string;
  fuel: string;
  source_type: string;
  geography_count: number;
  outlet_count: number;
  latest_applicable_date: string | null;
  latest_observed_at: string | null;
}