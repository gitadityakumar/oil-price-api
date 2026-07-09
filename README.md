# oil-price-api

Indian Fuel Price API — a native Node.js HTTP service for normalized fuel
pricing facts from official PPAC/OMC/CGD sources, with provenance, PIN
resolution, and freshness metadata.

Built on `node:http` (no Express/Fastify/Koa/Hapi/Nest), TypeScript strict
mode, and PostgreSQL via raw `pg`.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev      # tsx watch src/server.ts
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with tsx watch reload. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run compiled server (`node dist/server.js`). |
| `npm test` | Run Node's built-in test runner. |
| `npm run typecheck` | Type check without emitting. |
| `npm run lint` | Alias of `typecheck` for now. |

## Documentation

| Document | Purpose |
| --- | --- |
| `docs/api-contract.md` | Response envelopes, endpoints, schemas, errors, auth, rate headers. |
| `docs/openapi.yaml` | OpenAPI 3.1 contract for MVP routes. |
| `docs/data-schema.md` | Warehouse tables, keys, indexes, and public IDs. |
| `docs/source-strategy.md` | Source priority, legal notes, and fallback policy. |
| `docs/local-development.md` | Local Postgres/Redis setup and curl examples. |
| `docs/runbook.md` | Operational commands, replay, staleness, and pepper rotation. |
| `docs/security.md` | API key hashing, scopes, quotas, and secret handling. |
| `docs/release-checklist.md` | Release candidate verification checklist. |

## Status

Release-candidate guardrails are implemented through Task 10: schema,
read APIs, fixture ingestion, API key auth, scopes, rate limits, docs, OpenAPI,
and Node test coverage.
