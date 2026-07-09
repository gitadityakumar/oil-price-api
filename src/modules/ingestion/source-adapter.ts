import type { FuelCode } from '../prices/prices.model';

export interface SourceArtifactInput {
  artifactType: 'html' | 'pdf' | 'xlsx' | 'csv' | 'json' | 'other';
  originalUrl: string;
  bytes: Buffer;
  metadata?: Record<string, unknown>;
}

export interface CapturedArtifact {
  sourceKey: string;
  artifactType: SourceArtifactInput['artifactType'];
  originalUrl: string;
  bytes: Buffer;
  contentHash: string;
  storageUri: string;
  metadata: Record<string, unknown>;
}

export interface GeographyInput {
  countryCode?: string;
  stateName?: string;
  stateCode?: string;
  districtName?: string;
  cityName?: string;
  areaName?: string;
  pincode?: string;
  canonicalLabel: string;
}

export interface OutletInput {
  publicId?: string;
  operatorName?: string;
  outletName?: string;
  dealerCode?: string;
  addressText?: string;
  pincode?: string;
  cityName?: string;
  stateName?: string;
  fuelStationType?: 'ro' | 'cng_station' | 'lng_station' | 'png_tariff_area' | 'unknown';
  metadata?: Record<string, unknown>;
}

export interface ParsedPriceRecord {
  fuelCode: FuelCode;
  applicableDate: string;
  effectiveAt?: string;
  observedAt: string;
  priceValue: string;
  unit: string;
  geography?: GeographyInput;
  outlet?: OutletInput;
  priceKind?: 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context';
  components?: Array<{ name: string; value: string; unit: string }>;
  rawDocumentUrl?: string;
  attributionText?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedPriceFact {
  sourceKey: string;
  fuelCode: FuelCode;
  geography?: GeographyInput;
  outlet?: OutletInput;
  applicableDate: string;
  effectiveAt?: string;
  observedAt: string;
  priceValue: string;
  currencyCode: 'INR';
  priceKind: 'retail' | 'breakup_final' | 'tax_exclusive' | 'wholesale_context';
  components?: Array<{ name: string; value: string; unit: string }>;
  rawDocumentUrl?: string;
  rawHash: string;
  attributionText: string;
}

export interface IngestionContext {
  sourceKey: string;
  mode: 'manual' | 'scheduled' | 'fixture';
  now: Date;
  liveFetch: boolean;
  reason?: string;
  crawlRunId?: number;
}

export interface SourceAdapter {
  sourceKey: string;
  sourceType: 'ppac' | 'omc' | 'cgd' | 'regulator' | 'aggregator' | 'exchange';
  mode: 'primary' | 'reference' | 'fallback';
  fetchArtifacts(ctx: IngestionContext): Promise<SourceArtifactInput[]>;
  parseArtifact(artifact: CapturedArtifact, ctx: IngestionContext): Promise<ParsedPriceRecord[]>;
  normalize(record: ParsedPriceRecord, ctx: IngestionContext): Promise<NormalizedPriceFact[]>;
}
