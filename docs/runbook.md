# Operational Runbook

## Start API Server

```bash
npm install
cp .env.example .env
npm run dev
```

Production-style local start:

```bash
npm run build
npm start
```

The service uses native `node:http`.

## Run Migrations and Seeds

```bash
npm run db:migrate
npm run db:seed
# Local/test only:
npm run db:fixtures
```

`db:migrate` applies schema migrations. `db:seed` applies schema and reference
seeds but excludes fixtures. `db:fixtures` explicitly loads local/test data.

## Create API Clients

```bash
API_KEY_PEPPER=dev-pepper DATABASE_URL=postgres://postgres:postgres@localhost:5432/oilapi \
  npx tsx src/cli/create-api-client.ts --name "Dev Client" --tier free --scopes read:public
```

The plaintext `api_key` is printed once. Store only the shown value in the
client secret manager. The database stores only the HMAC hash.

## Start Scheduler and Worker

Start the durable PostgreSQL-backed scheduler and worker as separate processes:

```bash
npx tsx src/workers/scheduler.ts
npx tsx src/workers/ingestion-worker.ts
```

Run fixture ingestion directly for development:

```bash
npx tsx src/workers/ingestion-worker.ts --fixture ppac_rsp
npx tsx src/workers/ingestion-worker.ts --fixture igl_prices
```

## Inspect Source Health

```bash
curl -H "Authorization: Bearer $OPS_API_KEY" \
  http://localhost:8080/v1/internal/sources/health
```

The key needs `read:internal`.

## Replay a Failed Crawl

```bash
curl -X POST \
  -H "Authorization: Bearer $INGESTION_API_KEY" \
  -H "content-type: application/json" \
  -d '{"source_key":"ppac_rsp","mode":"manual","reason":"replay failed crawl"}' \
  http://localhost:8080/v1/internal/ingestion/runs
```

The key needs `write:ingestion`.

Manual and scheduled live runs are accepted only when the source is active,
`ingestion_enabled=true`, and its adapter declares validated live support.
Unverified adapters are rejected before a crawl or job is created.

## Stale or Expired Source Response

1. Check `/v1/internal/sources/health`.
2. Inspect `/v1/internal/crawl-runs?source_key=<source>`.
3. Replay the crawl with the manual ingestion endpoint.
4. If the source still fails, inspect fixture/live fetch errors and artifact
   hashes.
5. If stale but data is under 24 hours old, keep serving with warning logs.
6. If expired, prefer internal warehouse history and escalate source repair.

## Rotate `API_KEY_PEPPER`

The stored key hash depends on the pepper. Safe rotation requires reissuing API
keys or a dual-pepper transition.

1. Create new clients with the new pepper.
2. Distribute new plaintext keys to clients.
3. Confirm traffic on new `client_id` values.
4. Revoke old clients.
5. Deploy with only the new `API_KEY_PEPPER`.

Do not rotate the pepper alone without replacing client keys; existing hashes
will stop validating.
