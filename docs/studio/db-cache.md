# Catalog cache

`/db-cache` is the single home for everything cache-related in Studio:
live stats per cache table, per-profile freshness, the inventory of
cached `(profile, database)` rows, and the scheduled refreshes that
keep them warm. You can reach the page three ways:

- The **DB cache** entry in the sidebar
- The **Catalog cache** button in the Runs page header
- The freshness pill in the top bar — **Manage refreshes** link

The pill is read-only status now (a quick rollup of per-profile sync
ages); every action that mutates cache state lives on this page.

## Why we cache

Live `information_schema` queries against production warehouses are
expensive in latency, in cluster CPU, and on backends like BigQuery or
Snowflake in compute that consumes tokens on the active LLM
downstream. AMX caches the answers locally so:

- the Studio sidebar can paint schema and table trees instantly,
- `/ask` agent tools resolve `schema.table.column` references without
  a round-trip,
- per-table snapshot pages render comments and types from the cache,
- `/sync` and `sync_profile_skeleton` can populate the
  `catalog_entities` full-text index without re-asking every backend.

The trade-off is staleness: a DBA editing a column comment in the
warehouse will not be visible to AMX until the relevant cache row is
refreshed. This page is where you fix that.

## Page tour

### Stats cards

Three cards at the top of the page, one per cache table:

| Card | What it tracks |
|---|---|
| **`schemas_cache`** | total rows, distinct profiles, distinct databases, oldest fetch, newest fetch, TTL state |
| **`column_comments_cache`** | same counters, scoped at `(profile, database, schema, table)` |
| **`catalog_entities`** | the search index populated by `/sync`; row count + freshness |

The TTL state badge is green when the oldest row is within TTL, amber
when some rows have expired but are still served, and red when every
row in that table is past TTL.

### Profile freshness

A compact list of every DB profile with:

- Last sync timestamp (relative + absolute on hover)
- A per-profile **Sync now** button, or **Retry** if the last attempt
  failed
- A section-header **Sync all** button that fans out to every profile

This is the right tool when you want "refresh everything I know about
profile X" without filtering down to a single database or schema.

### Cache inventory

A DataTable with one row per `(profile, database)` pair:

| Column | Notes |
|---|---|
| Profile | Profile name |
| Database | Database / catalog, or `—` for catalog-only rows |
| Schemas | Row count in `schemas_cache` |
| Columns | Row count in `column_comments_cache` |
| Catalog | Row count in `catalog_entities` |
| Last fetch | Newest `last_fetch` across the three tables |
| Actions | **Clear** (this row only) |

A header-level **Clear all** wipes every cache row after confirmation.

**Clear is not Sync.** Clear only deletes rows; the next live read
will repopulate them lazily. If you want fresh data right now, use
**Sync now** instead — it actively re-fetches.

### Scheduled refreshes

A DataTable listing every `kind='cache_refresh'` schedule in
`scheduled_runs`. The PageHeader exposes a **New schedule** button
which opens the [Schedule cache refresh dialog](#schedule-cache-refresh-dialog).

Per-row actions: **Edit**, **Pause**, **Resume**, **Run now**,
**Delete**. Recurring schedules show their cron expression in a
tooltip; one-shot schedules show their single fire time.

The longer-form treatment of how schedules work lives in
[Concepts → Catalog cache](../concepts/catalog-cache.md).

## Manual refresh paths

There are four ways to trigger a sync. They all converge on the same
cache tables; the difference is scope and ergonomics.

| Path | Where | Best for |
|---|---|---|
| Freshness pill → **Manage refreshes** | Top bar | Quick status glance + jump to this page |
| **Sync all** / **Sync now** | This page, Profile freshness | Refresh a whole profile after a maintenance window |
| **Sync scope** | This page, PageHeader button | Surgical refresh after a single COMMENT edit or table change |
| Sidebar left-tree refresh icons | Per-profile, per-database/catalog, per-schema | In-context refresh while browsing |
| `/db cache-show`, `/db cache-stats`, `/db cache-clear` | CLI | Scripts, CI, terminal-first workflows |

The sidebar icons cover profile / database / catalog / schema. Table-
and column-level refreshes are only available through the Sync scope
dialog described below.

## Sync scope dialog

The PageHeader **Sync scope** button opens a dialog with:

- **DB profile** dropdown
- **Database / catalog** — cascades from the profile
- **ScopeTree** — pick one or many schemas / tables / columns
- **Confirm**

Submitting fires `POST /api/catalog/refresh`, which runs the
`cache_refresh_executor` synchronously. No `scheduled_runs` row is
written — this is an ad-hoc fire, not a schedule.

Typical use cases:

- A DBA just edited the comment on one column; refresh that column
  only.
- A table was dropped and recreated; refresh that table's row in
  `column_comments_cache`.
- A new schema was added; refresh that schema's slice of
  `schemas_cache` before pointing `/ask` at it.

## Schedule cache refresh dialog

Opened from **New schedule** in the Scheduled refreshes section.

- **DB profile** dropdown
- **Database / catalog**
- **ScopeTree** — profile / database / schema / table / column
- **First fire (local)** — datetime picker
- **Timezone** — IANA Select, browser-detected default
- **Recurrence** — `none` / `1h` / `6h` / `12h` / `1d` / `1w` /
  `custom`
- **Show cron syntax** — toggle to reveal the cron expression the
  dialog computed for the recurrence above
- **Deep sync** — checkbox. **Off** is the default: each fire
  warms the inventory and the column comments cache (a shallow
  sync). **On** flips the run into a deep sync that profiles
  every column and reads exact row counts for each table in scope
  — slower and more expensive, but it surfaces newly added
  columns and refreshes profiling statistics. The flag persists
  on the schedule row as `--deep`; the same flag is available on
  the CLI via `/analyze schedule add --kind cache_refresh --deep`.

The dialog persists the schedule as a `kind='cache_refresh'` row in
`scheduled_runs` with `cron_expr` set for recurring choices and
`NULL` for one-shot. After every fire — success or failure —
recurring schedules re-arm to `status='pending'` with a fresh
`fire_at_utc` computed by `croniter`.

## Per-table Deep sync

Tables on the **Table** detail page (`/db/:profile/:database/:schema/:table`)
expose a **Deep sync** button in the header. It runs a one-off
deep sync (column profiling + exact row count) for just that
table — useful for a quick "what does this column look like now?"
without scheduling a recurring refresh of the entire database.

Per-table deep sync writes its result back into the same
`column_comments_cache` row that the scheduled refresh updates, so
the next time Browse opens the table the cached row count and
profiling stats are current. The table detail panel also surfaces
the row count next to the column-count header, populated from
this deep sync.

## CLI parity

| Studio | CLI |
|---|---|
| Stats cards | `/db cache-stats` |
| Cache inventory | `/db cache-show [--profile=X] [--database=Y]` |
| Per-row Clear | `/db cache-clear --profile=X --database=Y` |
| Clear all | `/db cache-clear --type=all --force` |

Schedule management for `cache_refresh` runs is Studio-first today;
the existing `/schedule` CLI namespace handles `kind='analyze'`
schedules.
