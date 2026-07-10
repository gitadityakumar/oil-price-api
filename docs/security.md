# Security

## API Keys

Keys are easy to identify but are never stored in plaintext:

```txt
ifp_live_<client_id>_<secret>
ifp_test_<client_id>_<secret>
```

The database stores:

```txt
HMAC-SHA256(API_KEY_PEPPER, api_key)
```

Hash comparison uses `timingSafeEqual` and handles unequal lengths safely.

## Production Requirements

- `API_KEY_PEPPER` is required in production.
- Do not log API keys.
- Log only `client_id`, tier, request ID, status, cache status, and error code.
- Revoke compromised clients by setting `api_client.status = 'revoked'`.

## Scopes

| Scope | Purpose |
|---|---|
| `read:public` | Public read API. |
| `read:internal` | Source health and crawl audit. |
| `write:ingestion` | Manual ingestion trigger. |
| `admin:clients` | Reserved for future client administration. |

## Rate Limits and Quotas

Minute limits use `api_client.rate_limit_per_minute`. Daily quotas use
`api_client.quota_per_day` and `api_usage_daily`. Health checks do not consume
quota.

Redis is used for distributed minute limits and caching. The memory limiter is
available only for development and deterministic tests. Production startup
fails when `REDIS_URL` is absent, and production Redis failures fail closed.

Daily quota admission is an atomic PostgreSQL operation. Redis minute admission
uses one Lua operation that increments and sets expiry atomically.

## Headers

Default security headers:

```txt
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store for authenticated/internal responses
```

## Secret Handling

The client creation CLI prints the plaintext key once. Store it immediately in
the client secret manager. Never paste API keys into issue trackers, logs, or
shared docs.
