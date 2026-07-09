# API Contract - Indian Fuel Price API v1

All normal responses are JSON, use `snake_case`, and are versioned under `/v1`.
`/v1/health` is public. Every other endpoint requires API key auth.

## Auth

Supported formats:

```txt
Authorization: Bearer ifp_test_cli_xxx_secret
```

or:

```txt
X-Client-ID: cli_xxx
X-API-Key: ifp_test_cli_xxx_secret
```

Required scopes:

| Endpoint group | Scope |
|---|---|
| Public read endpoints | `read:public` |
| `/v1/internal/sources/health`, `/v1/internal/crawl-runs` | `read:internal` |
| `POST /v1/internal/ingestion/runs` | `write:ingestion` |

Rate limited responses include:

| Header | Meaning |
|---|---|
| `x-rate-limit-limit` | Client minute limit. |
| `x-rate-limit-remaining` | Remaining requests in the current minute. |
| `x-rate-limit-reset` | Unix epoch seconds when the minute resets. |

## Envelopes

Success:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_example",
    "api_version": "v1",
    "served_at": "2026-07-09T06:17:00.000Z",
    "cache": { "status": "MISS", "ttl_seconds": null }
  }
}
```

Paginated lists add:

```json
{
  "pagination": {
    "limit": 50,
    "offset": 0,
    "next_offset": 50,
    "total": 534
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Exactly one location selector is required: pin, city/state, state, or outlet_id.",
    "details": [{ "field": "pin", "reason": "Must be a 6 digit India Post PIN code." }],
    "request_id": "req_example"
  }
}
```

Cache status values are `MISS`, `HIT`, `BYPASS`, `STALE`, and
`STALE_REVALIDATED`.

## Schemas

### Price

```json
{
  "id": "price_example",
  "fuel": { "code": "PETROL", "label": "Petrol", "unit": "LTR" },
  "price": { "value": 96.72, "currency": "INR", "unit": "LTR", "kind": "retail" },
  "location": {
    "country_code": "IN",
    "state_name": "Delhi",
    "state_code": "DL",
    "district_name": "New Delhi",
    "city_name": "Delhi",
    "area_name": "Connaught Place",
    "pincode": "110001",
    "canonical_label": "Connaught Place, Delhi, DL 110001",
    "resolution": {
      "input_type": "pin",
      "input_value": "110001",
      "method": "city_fallback",
      "priority_rank": 4,
      "direct_from_source": false,
      "derived": true
    }
  },
  "outlet": null,
  "source": {
    "id": "src_ppac_rsp",
    "name": "PPAC RSP Archive",
    "type": "ppac",
    "operator_name": null,
    "reliability_tier": "highest",
    "attribution": "Price normalized from official publication.",
    "document_url": null
  },
  "provenance": {
    "applicable_date": "2026-07-09",
    "effective_at": "2026-07-09T00:30:00.000Z",
    "observed_at": "2026-07-09T00:47:00.000Z",
    "freshness_badge": "Observed from official source today at 06:17 IST",
    "confidence_score": 0.88,
    "raw_hash": "sha256:example"
  },
  "links": { "components": "/v1/prices/price_example/components" }
}
```

Allowed fuel codes: `PETROL`, `DIESEL`, `CNG`, `PNG`, `LNG`, `LPG`.

### Component Response

```json
{
  "price_id": "price_example",
  "components": [
    { "name": "base_price", "value": 57.35, "unit": "INR/LTR" },
    { "name": "excise", "value": 19.9, "unit": "INR/LTR" }
  ],
  "source": { "id": "src_ppac_rsp", "name": "PPAC RSP Archive", "document_url": null },
  "provenance": { "observed_at": "2026-07-09T00:47:00.000Z", "raw_hash": "sha256:example" }
}
```

### Station

```json
{
  "id": "outlet_example",
  "operator_name": "IndianOil",
  "name": "Example Fuel Station",
  "dealer_code": "123456",
  "type": "ro",
  "address": "Connaught Place, New Delhi",
  "location": {
    "pincode": "110001",
    "city_name": "Delhi",
    "state_name": "Delhi",
    "latitude": 28.6315,
    "longitude": 77.2167
  },
  "fuels": ["PETROL", "DIESEL"],
  "source": { "id": "src_iocl_retail", "name": "IOCL Retail Locator" },
  "links": { "prices": "/v1/stations/outlet_example/prices" }
}
```

### Source

```json
{
  "id": "src_igl_prices",
  "key": "igl_prices",
  "name": "IGL Prices",
  "type": "cgd",
  "operator_name": "Indraprastha Gas Limited",
  "canonical_url": "https://www.iglonline.net/cng-png-prices",
  "reliability_tier": "high",
  "commercial_use_allowed": null,
  "active": true,
  "last_successful_crawl_at": "2026-07-09T00:45:00.000Z",
  "last_observed_price_at": "2026-07-09T00:45:00.000Z"
}
```

### Source Health

```json
{
  "source": {
    "id": "src_ppac_rsp",
    "name": "PPAC RSP Archive",
    "type": "ppac",
    "reliability_tier": "highest"
  },
  "health": {
    "status": "healthy",
    "last_crawl_status": "success",
    "last_successful_crawl_at": "2026-07-09T00:47:00.000Z",
    "minutes_since_success": 10,
    "records_seen_last_run": 100,
    "records_written_last_run": 100,
    "staleness_level": "fresh"
  }
}
```

## Endpoints

| Method | Path | Scope | Purpose |
|---|---|---|---|
| GET | `/v1/health` | none | Service health. |
| GET | `/v1/prices` | `read:public` | Current/date-specific prices. |
| GET | `/v1/prices/history` | `read:public` | Historical price range. |
| GET | `/v1/prices/{id}/components` | `read:public` | Price breakup. |
| GET | `/v1/stations` | `read:public` | Station discovery. |
| GET | `/v1/stations/{id}` | `read:public` | Station detail. |
| GET | `/v1/stations/{id}/prices` | `read:public` | Station price lookup. |
| GET | `/v1/sources` | `read:public` | Source catalog. |
| GET | `/v1/sources/{id}` | `read:public` | Source detail by key. |
| GET | `/v1/coverage` | `read:public` | Coverage by state/fuel/source type. |
| GET | `/v1/internal/sources/health` | `read:internal` | Source health. |
| GET | `/v1/internal/crawl-runs` | `read:internal` | Crawl audit list. |
| POST | `/v1/internal/ingestion/runs` | `write:ingestion` | Manual fixture-backed crawl. |

## Query Parameters and Examples

`GET /v1/prices` requires exactly one location selector:
`pin`, `city`+`state`, `state`, or `outlet_id`.

Optional params: `fuel`, `date`, `include=components,outlet,source`,
`limit`, `offset`.

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices?pin=110001&fuel=PETROL&include=source,outlet"
```

`GET /v1/prices/history` requires one selector, `fuel`, `from`, and `to`.

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices/history?city=Delhi&state=Delhi&fuel=PETROL&from=2026-07-01&to=2026-07-09"
```

`GET /v1/stations` accepts `pin`, `city`, `state`, `fuel`, `operator`,
`limit`, and `offset`.

`GET /v1/sources` accepts `type`, `active`, `reliability_tier`, `limit`, and
`offset`.

`GET /v1/internal/crawl-runs` accepts `source_key`, `status`, `from`, `to`,
`limit`, and `offset`.

`POST /v1/internal/ingestion/runs` body:

```json
{ "source_key": "ppac_rsp", "mode": "manual", "reason": "replay failed crawl" }
```

## Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `CONFIG_ERROR` | 500 | Runtime configuration error. |
| `VALIDATION_ERROR` | 400 | Invalid query/body. |
| `AUTH_REQUIRED` | 401 | Missing API key. |
| `AUTH_INVALID` | 401 | Invalid, mismatched, disabled, or revoked key. |
| `FORBIDDEN` | 403 | Valid key lacks required scope. |
| `NOT_FOUND` | 404 | Entity/path not found. |
| `METHOD_NOT_ALLOWED` | 405 | Path exists but method unsupported. |
| `RATE_LIMITED` | 429 | Minute rate limit or daily quota exceeded. |
| `CONFLICT` | 409 | Duplicate/conflicting write. |
| `UPSTREAM_ERROR` | 502 | Source/vendor failure. |
| `DB_ERROR` | 500 | Database operation failed. |
| `NOT_IMPLEMENTED` | 501 | Scaffolded route not implemented. |
| `INTERNAL_ERROR` | 500 | Unexpected failure. |
