# Local Development

## Required Tools

- Node.js 20+
- npm
- PostgreSQL 14+
- Optional Redis for production-like rate limiting/cache

## Environment

```bash
cp .env.example .env
```

Set at minimum:

```txt
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/oilapi
API_KEY_PEPPER=dev-pepper
```

## Postgres

Example with Docker:

```bash
docker run --rm --name oilapi-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=oilapi \
  -p 5432:5432 postgres:16
```

Then:

```bash
npm run db:seed
```

## Redis

Optional:

```bash
docker run --rm --name oilapi-redis -p 6379:6379 redis:7
```

Set:

```txt
REDIS_URL=redis://localhost:6379
```

## Fixture Ingestion

```bash
npx tsx src/workers/ingestion-worker.ts ppac_rsp
npx tsx src/workers/ingestion-worker.ts igl_prices
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
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/prices/price_ppac_rsp_petrol_2026_07_09/components"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations?pin=110001"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations/outlet_example"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/stations/outlet_example/prices?fuel=PETROL"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/sources"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/sources/ppac_rsp"
curl -H "Authorization: Bearer $API_KEY" "http://localhost:8080/v1/coverage?fuel=PETROL&state=Delhi"
```
