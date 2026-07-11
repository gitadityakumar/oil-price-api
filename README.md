# oil-price-api

Indian Fuel Price API — a native Node.js HTTP service for normalized fuel
pricing facts from official PPAC/OMC/CGD sources, with provenance, PIN
resolution, and freshness metadata.

Built on `node:http` (no Express/Fastify/Koa/Hapi/Nest), TypeScript strict
mode, and PostgreSQL via raw `pg`.

## Quick start

**Full stack (API + workers + Postgres + Redis + MinIO):**

```bash
docker compose up --build
# API: http://localhost:8080/v1/health
```

**Host Node + Compose infra only:**

```bash
docker compose up -d postgres redis minio
npm ci
cp .env.example .env
# Point DATABASE_URL / REDIS_URL at localhost:55432 / :56379 (see .env.example)
npm run db:migrate
npm run db:seed
npm run db:fixtures # local fixture data only
npm run dev      # tsx watch src/server.ts
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with tsx watch reload. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run compiled server (`node dist/server.js`). |
| `npm test` | Run Node's built-in test runner serially. |
| `npm run test:ci` | Require PostgreSQL and run all tests plus the DB smoke gate. |
| `npm run typecheck` | Type check without emitting. |
| `npm run lint` | Run typed ESLint rules. |
| `npm run openapi:lint` | Validate OpenAPI with zero warnings. |
| `npm run db:fixtures` | Load local/test fixture data; never part of production seed. |

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

The local fixture-backed MVP has release guardrails, Docker-compatible
PostgreSQL/Redis/MinIO configuration, transactional ingestion, and required CI
gates. Production live sources remain fail-closed: each source requires legal
approval and a validated live adapter before `ingestion_enabled` and
`public_display_enabled` may be set.
