# Local Development

Two supported workflows:

1. **Full Docker stack** (recommended) — API, workers, Postgres, Redis, MinIO  
2. **Host Node + Compose infra** — only databases/cache in Docker  

Full Docker details: **[docker.md](./docker.md)**.

## Required tools

| Tool | Full Docker | Host Node |
|------|-------------|-----------|
| Docker / Podman + Compose | Yes | Yes (for infra) |
| Node.js 20+ and npm | Optional (smoke UI only) | Yes |

## Full stack with Docker

```bash
docker compose up --build
curl -sS http://localhost:8080/v1/health
```

| Endpoint | URL |
|----------|-----|
| API | http://localhost:8080 |
| Postgres (host tools) | `localhost:55432` |
| Redis | `localhost:56379` |
| MinIO API / console | http://localhost:59000 / :59001 |

Compose automatically runs **schema migrate** and **seed**. Internal hostnames
are `postgres`, `redis`, and `minio`. App services use:

- `API_KEY_PEPPER=compose-local-pepper-change-me`  
- `ARTIFACT_STORAGE_MODE=s3` → MinIO  

### Create an API key

```bash
docker compose exec api node dist/cli/create-api-client.js \
  --name "Local Dev" \
  --tier free \
  --scopes read:public,read:internal,write:ingestion
export API_KEY='<printed api_key>'
```

Or use the smoke UI create-key page (below).

### Sample data

```bash
# SQL fixture rows (fixed historical dates in migrations)
docker compose --profile fixtures run --rm migrate-fixtures

# HTML fixture ingestion (uses dates inside fixtures/ — often “today”)
docker compose run --rm --no-deps \
  -v "$PWD/fixtures:/app/fixtures:ro" \
  worker node dist/workers/ingestion-worker.js --fixture ppac_rsp

docker compose run --rm --no-deps \
  -v "$PWD/fixtures:/app/fixtures:ro" \
  worker node dist/workers/ingestion-worker.js --fixture igl_prices
```

Fixtures are not inside the image; the `-v` mount is required for HTML ingestion.

### Smoke frontend

Browser UI for PIN price lookup and creating API keys:

```bash
cd .smoke-frontend
npm install
npm run dev
```

| Page | URL |
|------|-----|
| Prices | http://localhost:5173 |
| Create key | http://localhost:5173/keys.html |

Vite proxies `/api` → `http://localhost:8080` by default (`VITE_API_TARGET`).

Create-key uses Compose DB defaults (`localhost:55432` + Compose pepper). If you
override API pepper, set `CREATE_CLIENT_API_KEY_PEPPER` / `API_KEY_PEPPER` in
`.smoke-frontend/.env` to the same value.

See [.smoke-frontend/README.md](../.smoke-frontend/README.md).

### Curl examples

```bash
curl -sS http://localhost:8080/v1/health
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices?pin=110001&fuel=PETROL"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices/history?pin=110001&fuel=PETROL&from=2026-07-01&to=2026-07-11"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices/price_example/components"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/stations?pin=110001"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/stations/outlet_example"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/stations/outlet_example/prices?fuel=PETROL"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/sources"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/sources/src_ppac_rsp"
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/coverage?fuel=PETROL&state=Delhi"
```

After HTML fixture ingestion for today, current prices for fixture PINs (e.g.
`110001`) return rows. SQL-only fixtures may only hit history/components for
older `applicable_date` values.

---

## Host Node + Compose infra

Use this when developing the TypeScript API with hot reload.

### Environment

```bash
docker compose up -d postgres redis minio
npm ci
cp .env.example .env
```

Minimum `.env` for Compose infra (note ports and pepper if you want keys to
match the Docker API later):

```txt
NODE_ENV=development
PORT=8080
DATABASE_URL=postgres://oilapi:oilapi@localhost:55432/oilapi
REDIS_URL=redis://localhost:56379
API_KEY_PEPPER=dev-pepper
ARTIFACT_STORAGE_MODE=local
```

To talk to MinIO from the host instead of local disk artifacts:

```txt
ARTIFACT_STORAGE_MODE=s3
S3_BUCKET=oil-api-artifacts
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:59000
S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=oilapi
AWS_SECRET_ACCESS_KEY=oilapi-secret
```

Create the MinIO bucket once (Compose `minio-init` does this when the full stack
runs; for infra-only you may need the same init or the MinIO console).

### Migrate, seed, run

```bash
npm run db:migrate
npm run db:seed
npm run db:fixtures   # local only; blocked when NODE_ENV=production
npm run dev           # API: tsx watch src/server.ts
```

Optional workers on the host:

```bash
npx tsx src/workers/scheduler.ts
npx tsx src/workers/ingestion-worker.ts
```

### Fixture ingestion (host)

```bash
npx tsx src/workers/ingestion-worker.ts --fixture ppac_rsp
npx tsx src/workers/ingestion-worker.ts --fixture igl_prices
```

### API client (host)

Pepper must match the process you will call:

```bash
# Host API with .env API_KEY_PEPPER=dev-pepper
npx tsx src/cli/create-api-client.ts \
  --name "Local Dev" --tier free \
  --scopes read:public,read:internal,write:ingestion
export API_KEY=<printed key>
```

### Redis without Compose

```bash
docker run --rm --name oilapi-redis -p 56379:6379 redis:7-alpine
```

```txt
REDIS_URL=redis://localhost:56379
```

---

## Pepper mismatch warning

| How you run the API | Default pepper |
|---------------------|----------------|
| `docker compose` app services | `compose-local-pepper-change-me` |
| Host `.env.example` | `dev-pepper` |

Creating a key with one pepper and calling an API that uses the other yields
**401 Unauthorized**. Always align `API_KEY_PEPPER` (and smoke-frontend create
env) with the running API.

## Further reading

| Doc | Purpose |
|-----|---------|
| [docker.md](./docker.md) | Compose services, image, ops, troubleshooting |
| [api-contract.md](./api-contract.md) | Envelopes, auth, endpoints |
| [runbook.md](./runbook.md) | Ops commands, replay, staleness |
| [security.md](./security.md) | Keys, scopes, production requirements |
