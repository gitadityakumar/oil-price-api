# Docker

Recommended way to run the full local stack: API, scheduler, ingestion worker,
PostgreSQL, Redis, and MinIO with one command.

## Prerequisites

- Docker Engine **or** Podman with a Compose provider (`docker compose`)
- Ports free on the host: **8080**, **55432**, **56379**, **59000**, **59001**

On machines where `docker` is Podman:

```bash
systemctl --user start podman.socket
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
```

## Quick start

From the repository root:

```bash
docker compose up --build
```

Wait until migrate/seed finish and the API is healthy, then:

```bash
curl -sS http://localhost:8080/v1/health
```

Expected: JSON with `"status":"ok"`.

### What starts

| Service | Role |
|---------|------|
| `postgres` | Warehouse (host port **55432**) |
| `redis` | Cache + rate limits (host **56379**) |
| `minio` | S3-compatible artifacts (API **59000**, console **59001**) |
| `minio-init` | Creates bucket `oil-api-artifacts` (one-shot) |
| `migrate` / `migrate-seed` | Schema + reference seed (one-shots) |
| `api` | HTTP API on **8080** |
| `scheduler` | Enqueues crawls (IST schedule) |
| `worker` | Runs ingestion jobs |

Compose sets `NODE_ENV=development` and wires internal DNS names (`postgres`,
`redis`, `minio`). This is a **local sandbox**, not a production deployment.
See [Production vs Compose](#production-vs-compose).

### Host ports

| Service | Host | In-network |
|---------|------|------------|
| API | `http://localhost:8080` | `http://api:8080` |
| Postgres | `localhost:55432` | `postgres:5432` |
| Redis | `localhost:56379` | `redis:6379` |
| MinIO S3 | `http://localhost:59000` | `http://minio:9000` |
| MinIO console | `http://localhost:59001` | — |

MinIO root user/password (local only): `oilapi` / `oilapi-secret`.

## Create an API key

### CLI (inside the API container)

Pepper and database already match Compose:

```bash
docker compose exec api node dist/cli/create-api-client.js \
  --name "Local Dev" \
  --tier free \
  --scopes read:public,read:internal,write:ingestion
```

Copy the printed `api_key` (shown once):

```bash
export API_KEY='ifp_test_cli_…'
curl -sS -H "Authorization: Bearer $API_KEY" \
  "http://localhost:8080/v1/prices?pin=110001&fuel=PETROL"
```

### Smoke frontend UI

```bash
cd .smoke-frontend
npm install
npm run dev
```

- Prices: http://localhost:5173  
- Create key: http://localhost:5173/keys.html  

The create-key page talks to Postgres on **55432** with pepper
`compose-local-pepper-change-me` (Compose default). That pepper **must** match
the running API or keys will get 401.

## Load sample data

### SQL fixtures (seed rows, fixed dates)

```bash
docker compose --profile fixtures run --rm migrate-fixtures
```

### Fixture HTML ingestion (today’s applicable dates)

Fixture HTML lives under `fixtures/ingestion/` and is **not** baked into the
image. Mount it when running the worker:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/fixtures:/app/fixtures:ro" \
  worker node dist/workers/ingestion-worker.js --fixture ppac_rsp

docker compose run --rm --no-deps \
  -v "$PWD/fixtures:/app/fixtures:ro" \
  worker node dist/workers/ingestion-worker.js --fixture igl_prices
```

Other fixture dirs: `gujarat_gas_prices`, `mgl_prices`, `mngl_prices`.

## Useful commands

```bash
# Logs
docker compose logs -f api
docker compose logs -f worker scheduler

# Status
docker compose ps

# Rebuild app image and recreate app processes
docker compose up -d --build api worker scheduler

# Stop and remove containers (volumes kept)
docker compose down

# Stop and wipe database/redis/minio volumes
docker compose down -v
```

### Infra only (API on the host with Node)

```bash
docker compose up -d postgres redis minio
# then: npm ci, .env, migrate, seed, npm run dev
```

See [local-development.md](./local-development.md).

## Image design

- Multi-stage **Alpine** `Dockerfile` → image tag `oil-api:local`
- Runtime contains `dist/`, production `node_modules`, and `migrations/` only
- One image, different commands:
  - API: `node dist/server.js`
  - Scheduler: `node dist/workers/scheduler.js`
  - Worker: `node dist/workers/ingestion-worker.js`
  - Migrate: `node dist/db/migrate.js` [`--seed` | `--fixtures`]
- HTTP healthcheck applies to **api** only; worker/scheduler disable it in
  `compose.yaml` (they do not listen on HTTP)

## Production vs Compose

| Topic | Compose (local) | Production |
|-------|-----------------|------------|
| `NODE_ENV` | `development` | `production` |
| Secrets | Weak defaults in `compose.yaml` | Strong secrets via secret manager / env |
| `API_KEY_PEPPER` | `compose-local-pepper-change-me` | Required, random, private |
| `REDIS_URL` | Set | Required |
| Fixtures | Allowed | Blocked |
| Host ports on DB/Redis | Published for convenience | Do not expose publicly |
| Artifacts | MinIO | Real S3 (or equivalent) + IAM |

There is no `compose.prod.yaml` yet. Production is the same image/process set
with production env (see `docs/security.md` and `.deploy/*.service` for a
VM-style layout).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| API unhealthy | `docker compose logs api`; `curl localhost:8080/v1/health` |
| Worker/scheduler “unhealthy” on old stacks | Rebuild/recreate; compose disables non-API healthchecks |
| 401 after creating a key | Pepper mismatch (Compose vs host `dev-pepper`) |
| Empty current prices | Run fixture ingestion for today (SQL fixtures use older dates) |
| Create-key UI fails | Postgres on 55432; stack up; same pepper as API |
| Compose cannot talk to engine (Podman) | `podman.socket` + `DOCKER_HOST` (see prerequisites) |
| Port already in use | Stop conflicting process or change host ports in `compose.yaml` |
