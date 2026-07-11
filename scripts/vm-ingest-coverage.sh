#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> Generating coverage fixtures"
npm run generate:coverage-fixtures

echo "==> Seeding PIN reference + enabling Plan 1 sources"
npm run seed:pin-reference

SOURCES=(ppac_rsp igl_prices mgl_prices mngl_prices gujarat_gas_prices)
for source in "${SOURCES[@]}"; do
  echo "==> Ingesting fixture: ${source}"
  node dist/workers/ingestion-worker.js --fixture "${source}"
done

echo "==> Verifying pin coverage"
npm run verify:pin-coverage

echo "==> Plan 1 coverage ingest complete"