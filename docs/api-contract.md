# API Contract — Indian Fuel Price API (v1)

This document freezes the public REST contract for the v1 API. All endpoints
return JSON only and use one of two standardized envelopes.

## Principles

- All endpoints are versioned under `/v1`.
- JSON only. Fields use `snake_case`.
- Timestamps are ISO 8601 (UTC, `Z` suffix).
- Prices are JSON numbers (decimal) backed by PostgreSQL `numeric` internally.
- Every price-bearing response includes source provenance and PIN resolution.
- Auth (API key) is required on every non-health endpoint.

## Success envelope

```json
{
  "data": {},
  "meta": {
    "request_id": "req_example",
    "api_version": "v1",
    "served_at": "2026-07-09T06:17:00.000Z",
    "cache": {
      "status": "MISS",
      "ttl_seconds": null
    }
  }
}
```

For arrays, `meta.pagination` is included:

```json
{
  "data": [],
  "meta": {
    "request_id": "req_example",
    "api_version": "v1",
    "served_at": "2026-07-09T06:17:00.000Z",
    "pagination": {
      "limit": 50,
      "offset": 0,
      "next_offset": 50,
      "total": 534
    },
    "cache": {
      "status": "HIT",
      "ttl_seconds": 3270
    }
  }
}
```

`meta.cache.status` is one of `MISS`, `HIT`, `BYPASS`, `STALE`. `next_offset`
is `null` when the end of the result set is reached.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Exactly one location selector is required: pin, city/state, state, or outlet_id.",
    "details": [
      { "field": "pin", "reason": "Must be a 6 digit India Post PIN code." }
    ],
    "request_id": "req_example"
  }
}
```

## Error codes

| Code | HTTP | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Invalid query/body. |
| `AUTH_REQUIRED` | 401 | Missing API key. |
| `AUTH_INVALID` | 401 | Invalid/revoked API key. |
| `FORBIDDEN` | 403 | Valid key lacks scope (e.g. internal ops on a client key). |
| `NOT_FOUND` | 404 | Entity/path not found. |
| `METHOD_NOT_ALLOWED` | 405 | Path exists but method unsupported. |
| `RATE_LIMITED` | 429 | Rate or quota exceeded. |
| `UPSTREAM_ERROR` | 502 | Source/vendor error during ingestion or fallback. |
| `NOT_IMPLEMENTED` | 501 | Route scaffolded, logic pending. |
| `INTERNAL_ERROR` | 500 | Unexpected failure. |

## Core output schemas

### Fuel

```json
{ "code": "PETROL", "label": "Petrol", "unit": "LTR" }
```

Allowed fuel codes: `PETROL`, `DIESEL`, `CNG`, `PNG`, `LNG`, `LPG`.

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

### Price components

```json
{
  "price_id": "price_example",
  "components": [
    { "name": "base_price", "value": 57.35, "unit": "INR/LTR" },
    { "name": "excise", "value": 19.9, "unit": "INR/LTR" },
    { "name": "vat", "value": 15.71, "unit": "INR/LTR" },
    { "name": "dealer_commission", "value": 3.76, "unit": "INR/LTR" }
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
  "fuels": ["PETROL", "DIESEL", "CNG"],
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

## Endpoint contract

### Public endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/v1/health` | Service health. | No |
| GET | `/v1/prices` | Current or date-specific prices by `pin`, `city`+`state`, `state`, or `outlet_id`. | Yes |
| GET | `/v1/prices/history` | Historical prices by location selector and fuel/date range. | Yes |
| GET | `/v1/prices/:id/components` | Price breakup components. | Yes |
| GET | `/v1/stations` | Station discovery by `pin`, `city`, `state`, `fuel`, `operator`. | Yes |
| GET | `/v1/stations/:id` | Station detail. | Yes |
| GET | `/v1/stations/:id/prices` | Station-level prices. | Yes |
| GET | `/v1/sources` | Active source catalog. | Yes |
| GET | `/v1/sources/:id` | Source detail. | Yes |
| GET | `/v1/coverage` | Coverage summary by state/fuel/source type. | Yes |

### Internal endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/v1/internal/sources/health` | Per-source crawl and staleness health. | Ops key |
| GET | `/v1/internal/crawl-runs` | Crawl run audit list. | Ops key |
| POST | `/v1/internal/ingestion/runs` | Trigger a source crawl manually. | Ops key |

## Query rules

### `GET /v1/prices`

Exactly one location selector is required:

- `pin=110001`
- `city=Delhi&state=Delhi`
- `state=Delhi`
- `outlet_id=outlet_example`

Optional filters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `fuel` | comma list | all launch fuels | Normalized to uppercase. |
| `date` | `YYYY-MM-DD` | today in Asia/Kolkata | Applicable date. |
| `include` | comma list | none | `components`, `outlet`, `source`. |
| `limit` | int | 50 | Max 100. |
| `offset` | int | 0 | Pagination offset. |

### `GET /v1/prices/history`

Required:

- One location selector.
- `fuel`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

Default max range: 366 days unless client tier allows more.

### `GET /v1/stations`

Supported filters: `pin`, `city`, `state`, `fuel`, `operator`, `limit`, `offset`.
Phase 2 may add `near=lat,lon` and `radius_km`.

## Validation rules

- `pin` must be exactly six digits.
- `fuel` is case-insensitive on input and uppercase on output.
- `date`, `from`, and `to` must be valid ISO dates.
- `include` may only contain documented values.
- `limit` max is 100 for read endpoints and 1000 for internal ops endpoints.

## Pagination

`meta.pagination.next_offset` is the offset to use for the next page, or
`null` when the end of the result set has been reached. `limit` is clamped to
`[1, 100]` on public endpoints and `[1, 1000]` on internal ops endpoints.