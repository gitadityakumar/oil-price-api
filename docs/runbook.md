# Operational Runbook

## Docker (recommended local stack)

Full API + scheduler + worker + Postgres + Redis + MinIO:

```bash
docker compose up --build
curl -sS http://localhost:8080/v1/health
```

Create a client against the Compose stack (pepper already set in compose):

```bash
docker compose exec api node dist/cli/create-api-client.js \
  --name "Ops Client" --tier free \
  --scopes read:public,read:internal,write:ingestion
```

Load SQL fixtures / HTML fixture crawls:

```bash
docker compose --profile fixtures run --rm migrate-fixtures

docker compose run --rm --no-deps \
  -v "$PWD/fixtures:/app/fixtures:ro" \
  worker node dist/workers/ingestion-worker.js --fixture ppac_rsp
```

Logs and lifecycle:

```bash
docker compose logs -f api worker scheduler
docker compose down          # keep volumes
docker compose down -v       # wipe DB/redis/minio data
```

See [docker.md](./docker.md) for ports, image layout, and troubleshooting.

## Start API Server (host Node)

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

Host:

```bash
npm run db:migrate
npm run db:seed
# Local/test only:
npm run db:fixtures
```

Compose (automatic on `docker compose up`; manual re-run):

```bash
docker compose run --rm migrate
docker compose run --rm migrate-seed
docker compose --profile fixtures run --rm migrate-fixtures
```

`db:migrate` applies schema migrations. `db:seed` applies schema and reference
seeds but excludes fixtures. `db:fixtures` explicitly loads local/test data and
is blocked when `NODE_ENV=production`.

## Create API Clients

Host (pepper must match the API process):

```bash
API_KEY_PEPPER=dev-pepper \
DATABASE_URL=postgres://oilapi:oilapi@localhost:55432/oilapi \
  npx tsx src/cli/create-api-client.ts --name "Dev Client" --tier free --scopes read:public
```

Compose:

```bash
docker compose exec api node dist/cli/create-api-client.js \
  --name "Dev Client" --tier free --scopes read:public
```

UI: start `.smoke-frontend` and open http://localhost:5173/keys.html

The plaintext `api_key` is printed once. Store only the shown value in the
client secret manager. The database stores only the HMAC hash.

## Start Scheduler and Worker

### Docker

Included in `docker compose up` as services `scheduler` and `worker`.

### Host Node

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
