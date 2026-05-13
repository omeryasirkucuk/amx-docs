# DB cache

`/db-cache` inspects and clears the metadata cache AMX maintains per
DB profile. The cache speeds up Browse and `/ask` by avoiding repeated
`information_schema` lookups; this page is where you go when you
suspect the cache is stale.

## Stats cards

Top of the page: three cards covering the three cache kinds AMX
maintains.

| Card | What it shows |
|---|---|
| **Schemas** | Total rows in the schemas cache, oldest fetch timestamp, % expired (older than TTL) |
| **Columns** | Same for the column-comments cache |
| **Catalogs** | Same for the catalog-entities cache (Databricks UC / BigQuery) |

## Cache contents table

A DataTable below the stats, one row per (profile, database) pair:

| Column | Notes |
|---|---|
| Profile | Profile name |
| Database | Database / catalog, or `—` for catalog-only rows |
| Schemas | Row count in the schemas cache |
| Columns | Row count in the column-comments cache |
| Catalogs | Row count in the catalog-entities cache |
| Actions | **Clear** button (clears just this row) |

A **Clear all** button (top-right) wipes every cache row after
confirmation.

## When to clear

- A schema rename / drop happened outside AMX and the sidebar still
  shows the old layout
- Column comments were edited directly in the database and `/ask`
  doesn't see them
- A backend upgraded its `information_schema` semantics

After clearing, the next Browse or `/ask` request re-populates the
cache from the live database.

## CLI equivalents

| Studio | CLI |
|---|---|
| Stats cards | `/cache-stats` |
| Cache contents table | `/cache-show [--profile=X] [--database=Y]` |
| Per-row Clear | `/cache-clear --profile=X --database=Y` |
| Clear all | `/cache-clear --type=all --force` |

## What's next

- [DB CLI](../cli/overview.md) — the full `/db` namespace including the
  cache commands above.
