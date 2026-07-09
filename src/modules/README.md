# modules/

Feature modules organized by MVC boundaries:

- `controller` — HTTP request parsing and response shaping only.
- `service` — business rules only.
- `repository` — database queries only.
- `model` — domain and persistence types.

Current modules:

- `prices` — price read API + pricing facts.
- `stations` — fuel station directory.
- `sources` — upstream source metadata and provenance.
- `locations` — PIN/region resolution.
- `auth` — API key authentication and quotas.
- `health` — service health checks.
- `ingestion` — source adapters and crawled run logging.

Each module is scaffolded in a later task; this directory commits its structure now.