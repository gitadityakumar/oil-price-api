# Oil API — Smoke Test Frontend

Minimal browser UI to smoke-test the deployed Indian Fuel Price API. Lives in `.smoke-frontend/` and is **not committed** (see parent `.gitignore`).

## Quick start

```bash
cd .smoke-frontend
npm install
npm run dev
```

Open **http://localhost:5173**, enter a 6-digit India PIN, and click **Get prices**.

**Create API key:** **http://localhost:5173/keys.html** (dev server only).

## What it does

- Calls `GET /v1/prices?pin={PIN}` (defaults: PETROL, DIESEL, CNG, PNG).
- Sends `Authorization: Bearer <api_key>`.
- Proxies through Vite so the browser hits `/api/v1/...` instead of the LAN backend directly (avoids CORS / private-network issues).
- **Create key** page posts to `POST /dev/create-api-client`, which runs the oil-api
  `create-api-client` CLI against Postgres (local smoke helper — not a public API).

## Configuration

| Setting | Default | Override |
|--------|---------|----------|
| Backend URL (proxy target) | `http://localhost:8080` | Set `VITE_API_TARGET` in `.env` or env when starting Vite |
| API key | `ifp_test_cli_D3rI_g802lD7_…` (test client) | **Settings** panel or **Create key** → “Use this key” (`localStorage`) |
| Create-client DB | `postgres://oilapi:oilapi@localhost:55432/oilapi` | `CREATE_CLIENT_DATABASE_URL` or `DATABASE_URL` |
| Create-client pepper | `compose-local-pepper-change-me` (Compose default) | `CREATE_CLIENT_API_KEY_PEPPER` or `API_KEY_PEPPER` |

Example `.env`:

```env
VITE_API_TARGET=http://localhost:8080
CREATE_CLIENT_DATABASE_URL=postgres://oilapi:oilapi@localhost:55432/oilapi
CREATE_CLIENT_API_KEY_PEPPER=compose-local-pepper-change-me
```

**Important:** `API_KEY_PEPPER` used when creating keys must match the pepper of the
running API (Compose sets `compose-local-pepper-change-me`).

## Sample PINs

- **110001** — Delhi  
- **560001** — Bengaluru  
- **400001** — Mumbai  

## Error handling

- **401** — invalid/missing API key (check Settings).
- **meta.warnings** — e.g. `NO_RESOLUTION`, `NO_PRICE_AVAILABLE` shown as warning banners.
- Network failures — proxy/backend unreachable.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port **5173** with `/api` proxy |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview build (proxy still applies) |

## Health check (manual)

```bash
curl -s http://192.168.122.212:8080/v1/health
```

Or via proxy while dev server is running:

```bash
curl -s http://localhost:5173/api/v1/health
```