# Local Development

## Required Tools

- Node.js 20+
- npm
- PostgreSQL 14+
- Redis 7 for production-like rate limiting/cache
- Optional MinIO for local S3-compatible artifact testing

## Environment

```bash
cp .env.example .env
```

Set at minimum:

```txt
NODE_ENV=development
DATABASE_URL=postgres://oilapi:oilapi@localhost:55432/oilapi
REDIS_URL=redis://localhost:56379
API_KEY_PEPPER=dev-pepper
```

## Full stack with Docker

Build the minimal app image and start API, scheduler, worker, Postgres, Redis,
and MinIO on one Compose network:

```bash
docker compose up --build
```

- API: `http://localhost:8080/v1/health`
- Postgres (host): `localhost:55432`
- Redis (host): `localhost:56379`
- MinIO API / console: `localhost:59000` / `localhost:59001`

Compose applies schema + seed automatically (`migrate`, `migrate-seed`). Optional
fixture rows:

```bash
docker compose --profile fixtures run --rm migrate-fixtures
```

Create an API client against the running stack:

```bash
docker compose exec api node dist/cli/create-api-client.js \
  --name "Local Dev" --tier free \
  --scopes read:public,read:internal,write:ingestion
```

Inside Compose, services reach each other by name (`postgres`, `redis`,
`minio`), not `localhost`. The app image is multi-stage Alpine; production
deps only.

## Postgres (infra only)

Infra containers without the Node app:

```bash
docker compose up -d postgres redis minio
```

Then on the host:

```bash
npm run db:migrate
npm run db:seed
npm run db:fixtures
```

## Redis

Without Compose:

```bash
docker run --rm --name oilapi-redis -p 56379:6379 redis:7-alpine
```

Set:

```txt
REDIS_URL=redis://localhost:56379
```

## Fixture Ingestion

```bash
npx tsx src/workers/ingestion-worker.ts --fixture ppac_rsp
npx tsx src/workers/ingestion-worker.ts --fixture igl_prices
```

## API Client

```bash
npx tsx src/cli/create-api-client.ts --name "Local Dev" --tier free --scopes read:public,read:internal,write:ingestion
export API_KEY=<printed key>
```

## Curl Examples

```bash
curl http://localhost:8080/v1/health
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/prices?pin=110001&fuel=PETROL"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/prices/history?pin=110001&fuel=PETROL&from=2026-07-01&to=2026-07-09"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/prices/price_example/components"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations?pin=110001"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations/outlet_example"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations/outlet_example/prices?fuel=PETROL"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/sources"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/sources/src_ppac_rsp"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/coverage?fuel=PETROL&state=Delhi"
```
