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
- [x] PostgreSQL-backed tests run serially and are required by CI.
- [x] Redis cache and atomic minute limiter have a local integration test.
- [x] S3-compatible artifact storage is implemented and verified against local MinIO.
- [x] Source rights and public display default to fail-closed.
- [ ] Legal approval recorded for each production display source.
- [ ] At least one liquid and one gas live adapter pass real-source canaries.
- [ ] Production source rows are explicitly enabled after legal and canary approval.

## Quality Gates

Run before release:

```bash
npm run check
npm run db:migrate
npm run db:seed
npm run test:ci
```

The test suite includes a forbidden-framework guard for Express, Fastify, Koa,
Hapi, Nest, and Apollo Server.
