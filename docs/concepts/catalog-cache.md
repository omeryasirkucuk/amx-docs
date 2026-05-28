# Catalog cache

AMX keeps a local SQLite mirror of the shape and comment data it reads
from connected databases. Every schema list, table list, column
definition, and column comment that AMX fetches from a live backend is
written into this cache on the way back. Subsequent reads come from the
cache instead of re-querying the warehouse.

## Why a cache?

Live `information_schema` queries have costs that compound quickly:

- **Latency** — a full schema walk of a large warehouse can take tens
  of seconds.
- **Cluster CPU** — Databricks, Snowflake, and BigQuery charge for
  query slots regardless of whether the query is user-facing.
- **Rate limits** — some backends throttle metadata APIs under high
  concurrency.

AMX's sidebar, `/ask` agent tools, and `/sync` all need schema
awareness; without a cache they would each fire independent live
queries. The cache absorbs that pressure and lets every surface share
a single warmed copy.

## What gets cached

Three tables hold the cached data:

| Table | Key | What it stores |
|---|---|---|
| `schemas_cache` | `(db_profile, database)` | List of schema names visible in the database |
| `column_comments_cache` | `(db_profile, database, schema, table)` | Column names, types, and comments for one table |
| `catalog_entities` | `(db_profile, database, schema, table)` | Full-text search index entries populated by `/sync` |

A fourth pair of tables caches database and catalog lists (for
backends that distinguish the two):

| Table | Key |
|---|---|
| `databases_cache` | `(db_profile,)` |
| `catalogs_cache` | `(db_profile,)` |

The scope key always includes `db_profile` so two profiles pointing at
the same physical server never share or overwrite each other's rows.

## Cache lifecycle

### Populate

A cache miss triggers a live query to the backend, then writes the
result back into the appropriate cache table before returning. The
first time you expand a schema in the sidebar, AMX fetches the table
list live and caches it; the next expand is instant.

`sync_profile_skeleton` (triggered by "Sync now" / "Sync all" /
`/db cache-refresh`) does a proactive full walk of the profile and
warms all three tables in one pass.

### Serve

Cache rows are served directly with no TTL check on the hot path — a
present row is returned immediately. Staleness is surfaced through the
freshness pill in the top bar and the Profile freshness section on the
[Catalog cache page](../studio/db-cache.md), but it does not block
reads.

### Invalidate

Rows are invalidated (deleted or overwritten) in four situations:

1. **COMMENT write** — when `/annotate`, `/sync`, or the Pending
   review apply a comment change, the affected `column_comments_cache`
   row is invalidated so the next read fetches the fresh value.
2. **Manual clear** — the per-row **Clear** button or `/cache-clear`
   CLI wipes the selected `(profile, database)` slice. The rows are
   deleted; the next sidebar expand repopulates lazily.
3. **Sync** — `sync_profile_skeleton` overwrites every row for the
   profile unconditionally, so it both invalidates and re-populates in
   one step.
4. **Scope refresh** — `POST /api/catalog/refresh` (the Sync scope
   dialog) invalidates and re-populates the subset you picked.

## Scheduled refreshes

A `scheduled_runs` row with `kind='cache_refresh'` fires
`cache_refresh_executor` at the scheduled time instead of the LLM
analysis path.

### One-shot vs recurring

- **One-shot** — `cron_expr` is `NULL`; the schedule fires once and
  moves to `completed`.
- **Recurring** — `cron_expr` holds a standard 5-field cron expression
  (e.g. `0 */6 * * *` for every 6 hours). After every fire — success
  or failure — `arm_next_fire()` computes the next occurrence via
  `croniter` and resets the row to `status='pending'` with a fresh
  `fire_at_utc`. The schedule never terminates on its own.

### Re-arm behavior

`_try_rearm_recurring()` is called in both the success and failure
paths of the worker, before the terminal status is written. This means
a transient connection error does not stop future refreshes; the
schedule simply re-arms and tries again at the next cron tick.

Recurring cache refresh schedules are intentionally excluded from the
sweeper that skips profiles with active schedules — the sweeper's
role is TTL cleanup, which is independent of scheduled refresh.

### Scope payload

The executor reads `scope_json` from the payload:

| `mode` value | What runs |
|---|---|
| `"all"` (default) | Full `sync_profile_skeleton` for the profile |
| `"schemas"` | Invalidate + re-fetch schema list only |
| `"tables"` | Invalidate + re-fetch table list for each named schema |
| `"columns"` | Invalidate + re-fetch column comments for each named table |

## See also

- [Catalog cache page](../studio/db-cache.md) — the Studio surface
  for all cache operations.
- [Schedules](../studio/schedules.md) — the LLM-driven analyze
  schedule page (separate from cache refresh).
