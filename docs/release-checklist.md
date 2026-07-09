# Release Checklist

- [x] Environment variables documented in `.env.example`.
- [x] Migrations run cleanly from blank database through `npm run db:migrate`
  when `DATABASE_URL` points at Postgres.
- [x] Seeds are idempotent through `npm run db:seed`.
- [x] API starts with native `node:http`.
- [x] API key auth protects public endpoints.
- [x] Ops scopes protect internal endpoints.
- [x] Rate limit headers are present.
- [x] Price responses include provenance and resolution metadata.
- [x] `observed_at` and `effective_at` appear separately.
- [x] PNGRB/reference-only records cannot be selected for commercial retail display.
- [x] Raw artifacts are stored through artifact store metadata and fixture storage.
- [x] Crawl runs are auditable through `/v1/internal/crawl-runs`.
- [x] Fixture ingestion can run without live network access.
- [x] OpenAPI spec matches the MVP route surface.
- [x] Runbook has stale-source troubleshooting steps.

## Quality Gates

Run before release:

```bash
npm run build
npm run typecheck
npm test
npm run lint
npm run db:migrate
```

The test suite includes a forbidden-framework guard for Express, Fastify, Koa,
Hapi, Nest, and Apollo Server.
