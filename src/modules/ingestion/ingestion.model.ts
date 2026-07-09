/**
 * Ingestion module domain + persistence types.
 *
 * Ingestion writes crawl_run rows, source artifacts, and upserts price facts.
 * It does not own new tables beyond those already defined in the schema; these
 * types describe the rows it produces for repositories and services.
 */

export type UpsertPriceFactInput = {
  public_id: string;
  source_id: number;
  outlet_id?: number | null;
  geography_id?: number | null;
  fuel_id: number;
  applicable_date: string;
  effective_at?: string | null;
  observed_at: string;
  price_value: number;
  currency_code?: string;
  price_kind: 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context';
  confidence_score?: number | null;
  raw_document_url?: string | null;
  raw_hash?: string | null;
  attribution_text?: string | null;
};

export type UpsertPriceComponentInput = {
  price_fact_id: number;
  component_name: string;
  component_value?: number | null;
  component_unit?: string | null;
};

export type StartCrawlRunInput = {
  source_id: number;
  started_at?: string;
};

export type FinishCrawlRunInput = {
  crawl_run_id: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  finished_at?: string;
  http_status?: number | null;
  records_seen?: number;
  records_written?: number;
  notes?: string | null;
  error_code?: string | null;
  error_message?: string | null;
};