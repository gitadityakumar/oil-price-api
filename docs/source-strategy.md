# Source Strategy

## Liquid Fuels

Liquid retail prices prefer official public data in this order:

1. PPAC RSP/state publications.
2. IOCL, BPCL, and HPCL retail surfaces.
3. Internal warehouse history from prior successful crawls.

PPAC is the primary normalized state/city anchor. OMC surfaces fill station or
operator-specific gaps and cross-check current values.

## Gas

Gas prices prefer city gas distribution sources first:

1. IGL, Gujarat Gas, MGL, MNGL, and CUGL current/rate-card pages.
2. PNGRB only for reference and validation.
3. Internal warehouse history when current public pages are unavailable.

PNGRB records are not selected for commercial retail display. They can validate
coverage, operators, and regulated context.

## Commercial API Fallback

Commercial feeds may be used only when official public sources fail freshness
requirements and licensing allows derived normalized facts. Fallback data must
retain vendor provenance, avoid mixing terms, and never overwrite official
source facts with lower-trust records when both are fresh.

## Legal Notes

- Store normalized facts and provenance, not verbatim page republishing.
- Keep attribution text and canonical source URLs.
- Do not include raw API keys, secrets, or full raw source documents in logs.
- PNGRB is reference-only for validation and regulator context.
- Respect source terms for commercial use; mark unknown permissions as
  `commercial_use_allowed = null`.

## LNG Phase 3

LNG support remains a Phase 3 expansion. The schema already allows `LNG`, but
MVP source ranking and public read behavior focus on petrol, diesel, CNG, and
PNG fixtures.
