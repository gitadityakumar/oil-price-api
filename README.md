# oil-price-api

Indian Fuel Price API — a native Node.js HTTP service for normalized fuel
pricing facts from official PPAC/OMC/CGD sources, with provenance, PIN
resolution, and freshness metadata.

Built on `node:http` (no Express/Fastify/Koa/Hapi/Nest), TypeScript strict
mode, and PostgreSQL via raw `pg`.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev      # tsx watch src/server.ts
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with tsx watch reload. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run compiled server (`node dist/server.js`). |
| `npm test` | Run Node's built-in test runner. |
| `npm run typecheck` | Type check without emitting. |
| `npm run lint` | Alias of `typecheck` for now. |

## Status

Foundation scaffold complete (Task 1). Database schema, native HTTP router,
API contract, and ingestion layers arrive in subsequent tasks.