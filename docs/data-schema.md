# Data Schema

The warehouse is normalized around source, geography, outlet, fuel, daily price
facts, components, PIN resolution, crawl audit, artifacts, and API clients.

## Entity Overview

`source_catalog` publishes facts into `price_fact_daily`. A fact belongs to one
`fuel_dim` row and to either `geography_dim`, `outlet_dim`, or both. Optional
`price_component_fact` rows break a final price into taxes, base price, and
commission. `pincode_resolution` maps a request PIN to the best geography or
outlet candidate. `crawl_run` and `source_artifact` record ingestion evidence.
`api_client` and `api_usage_daily` protect and meter API access.

## Tables

### `source_catalog`

Canonical source registry. Important fields are `source_key`,
`source_type`, `reliability_tier`, `commercial_use_allowed`, and `active`.
`source_key` is unique and used in public IDs, route filters, and ingestion.

### `geography_dim`

Normalized country/state/district/city/area/PIN geography. Important indexes:
`pincode`, `lower(city_name), lower(state_name)`, and `lower(state_name)`.

### `outlet_dim`

Retail outlet or gas tariff-area location. `public_id` is added by migration
003 and is the public station identifier. PIN, city/state, and dealer code
indexes support station discovery.

### `fuel_dim`

Small dimension for `PETROL`, `DIESEL`, `CNG`, `PNG`, `LNG`, and `LPG`.
`fuel_code` is unique and appears in API responses.

### `price_fact_daily`

Daily normalized price fact. Unique keys:

- `public_id` is globally unique for external references.
- `(source_id, outlet_id, geography_id, fuel_id, applicable_date, price_kind)`
  prevents duplicate facts for the same source/location/fuel/day/kind.

Important indexes:

- `price_fact_daily_public_idx` for `/v1/prices/{id}/components`.
- `price_fact_daily_lookup_idx` for read-path filtering.
- `price_fact_daily_observed_idx` for freshness queries.

Both `geography_id` and `outlet_id` exist because some sources publish city,
state, or tariff-area prices while others publish station-level facts. The
check constraint requires at least one location target.

`effective_at` and `observed_at` are separate. `effective_at` is when the price
became valid according to the source. `observed_at` is when this API collected
or confirmed it. A crawl can observe an older effective price.

### `price_component_fact`

Optional breakdown for one price fact. `(price_fact_id, component_name)` is
unique so repeated ingestion updates components idempotently.

### `pincode_resolution`

Maps PINs to `geography_dim` or `outlet_dim` with a ranked resolution method:
`direct_station_pin`, `nearest_station_geo`, `tariff_area_mapping`, or
`city_fallback`.

### `crawl_run`

Audit row for each source crawl. Tracks lifecycle, HTTP status, records seen
and written, and failure details. `(source_id, started_at desc)` supports
source health and audit listings.

### `source_artifact`

Metadata for captured raw source artifacts. The database stores hashes and
storage URIs, not raw bytes. `(source_id, content_hash)` is unique.

### `api_client`

Client registry. Stores only `key_hash`, never plaintext API keys. `client_id`
is unique. `scopes` defaults to `read:public`.

### `api_usage_daily`

Per-client daily quota counter keyed by `(usage_date, api_client_id)`.

## Public ID Conventions

- Sources use `src_<source_key>`.
- Outlets use stable `outlet_*` IDs.
- Price facts use deterministic `price_*` IDs derived from source, fuel,
  date, kind, and location keys.
- API clients use `cli_*` IDs and keys formatted as
  `ifp_test_<client_id>_<secret>` or `ifp_live_<client_id>_<secret>`.
