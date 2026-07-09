/**
 * Source module domain + persistence types.
 */

export type SourceType = 'ppac' | 'omc' | 'cgd' | 'regulator' | 'aggregator' | 'exchange' | 'internal';
export type ReliabilityTier = 'highest' | 'high' | 'medium' | 'low';

export type SourceCatalogRow = {
  source_id: number;
  source_key: string;
  source_name: string;
  source_type: SourceType;
  operator_name: string | null;
  canonical_url: string;
  terms_summary: string | null;
  commercial_use_allowed: boolean | null;
  reliability_tier: ReliabilityTier;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrawlRunStatus = 'started' | 'success' | 'partial' | 'failed' | 'skipped';

export type CrawlRunRow = {
  crawl_run_id: number;
  source_id: number;
  started_at: string;
  finished_at: string | null;
  status: CrawlRunStatus;
  http_status: number | null;
  records_seen: number;
  records_written: number;
  notes: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export type ArtifactType = 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other';

export type SourceArtifactRow = {
  artifact_id: number;
  source_id: number;
  crawl_run_id: number | null;
  artifact_type: ArtifactType;
  original_url: string | null;
  storage_uri: string;
  content_hash: string;
  captured_at: string;
  metadata_json: Record<string, unknown>;
};