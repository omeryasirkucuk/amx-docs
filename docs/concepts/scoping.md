# Multi-profile scoping

Every AMX command that mutates metadata — `/analyze run`, `/generate`,
`/analyze schedule add`, `/ask` retrieval, the Studio Browse and `/runs/new`
pages — narrows its work to a **scope**. A scope is a sequence of picks:
which DB profile, which database / catalog, which schema, which table, which
columns. AMX exposes one cascading picker for all of those surfaces so the
mental model stays the same across the REPL, the wizards, and the Studio
multi-profile sidebar.

This page documents the scope vocabulary, the picker's cascading shape, and
the `column_overrides` payload field that lets a single run target a precise
mix of columns across many tables.

## Vocabulary

| Term | Meaning |
|---|---|
| Profile | A saved DB connection (`/add-db-profile`). One profile points at one host, one user, one default database / catalog. |
| Database / catalog | The outermost container the profile reaches: `database` on 2-level backends (PostgreSQL, MySQL, MSSQL, Snowflake, …), `catalog` on 3-level backends (Databricks Unity Catalog, BigQuery). |
| Schema | One layer in from database / catalog. The picker treats schemas as the unit you usually filter on. |
| Asset | A table, view, or materialized view. The picker groups them together; the orchestrator preserves the kind in the run row. |
| Column | A column inside an asset. Column-level scope is opt-in — most runs operate on whole assets and let the orchestrator pick which columns to draft based on the configured profiling mode. |

A scope spec is the compact string AMX persists once the picker exits. It is
the same shape the [`/analyze schedule`](../cli/schedules.md#scope-spec)
reference describes.

## Cascading picker

The picker walks the layers top-down and only opens the next level once the
prior one is settled. Each level remembers the last pick so opening the
picker a second time from the same surface fast-forwards through layers
that didn't change.

```
Profile      ▾ prod-pg
  Database   ▾ analytics
    Schema   ▾ public
      Table  ▾ users        ☑
      Table  ▸ orders       ☐
      Table  ▸ events       ☐
    Schema   ▸ reporting
  Database   ▸ staging
Profile      ▸ dev-snowflake
```

A few rules the picker enforces:

- Picking a higher level is **inclusive** of everything below — picking the
  `public` schema with no table picks selects every asset in `public`.
- Picking a lower level is **specific** — the moment you tick one table,
  the schema row becomes an indeterminate parent. The run will target only
  the ticked tables.
- Column rows are reachable from the table level. Ticking a column promotes
  the table to indeterminate (some columns ticked, not all). The run will
  only re-describe those columns.
- Cross-profile picks are allowed — tick `prod-pg.analytics.public.users`
  and `dev-snowflake.RAW.SALES.ORDERS` in the same picker; the orchestrator
  fans out per-profile and merges results back into one run row.

## Scope spec — what AMX writes for you

Once the picker exits, AMX flattens the picks into a compact spec. The CLI
uses the spec verbatim — every surface that consumes a scope (`/analyze run`,
`/analyze schedule add`, the Studio run wizard, `/api/runs/new`) accepts the
same vocabulary:

| Spec | Meaning |
|---|---|
| `all` | Every schema the profile reaches. |
| `schema:public,sales` | The named schemas (any asset inside). |
| `table:public.users,sales.orders` | Schema-qualified asset list. |
| `column:public.users.email,public.users.first_name` | Schema- and asset-qualified column list. |

Multi-profile picks are encoded the same way — the orchestrator carries the
profile name forward as a separate field, so the spec doesn't need a profile
prefix.

## `column_overrides` body field

The Studio `/runs/new` wizard and `POST /api/runs/new` accept a structured
`column_overrides` object alongside the scope spec. The field lets the wizard
narrow a multi-table scope to specific columns per table without re-encoding
the scope as a flat `column:` list:

```json
{
  "scope_spec": "schema:public",
  "column_overrides": {
    "public.users": ["email", "first_name", "last_name"],
    "public.orders": ["created_at", "status"]
  }
}
```

When `column_overrides` is present:

- The orchestrator still walks the scope spec to find the candidate assets.
- For each asset that appears as a key in `column_overrides`, only the listed
  columns are drafted. Other assets in scope are drafted in full as usual.
- The Studio run-detail page shows the override block under the **Scope**
  tab so reviewers can see why a wide schema picked a narrow row count.

The CLI mirrors this with the `column:` spec shape above; the picker chooses
which form to use based on whether the picks are concentrated in one table
or spread thin across a wider scope.

## Per-tab scope (Studio)

The Studio Browse pages encode the full scope in the URL:

| URL shape | Backend kind |
|---|---|
| `/db/:profile/:database/:schema/:table` | 2-level (PostgreSQL, MySQL, MSSQL, Snowflake, …) |
| `/cat/:profile/:catalog/:schema/:table` | 3-level (Databricks Unity Catalog, BigQuery) |

Two browser tabs on different profiles share zero state — an inline comment
edited on profile X writes to profile X's backend regardless of what some
other tab is viewing. The same `column_overrides` shape powers per-row
Generate buttons on the Table page, so a one-off column refresh is the same
audit shape as a bulk run that happens to scope down to one column.

## Verify

```text
> /analyze run
Pick a scope:
  [1] All schemas (prod-pg)
  [2] Schemas         → opens picker
  [3] Tables          → opens picker
  [4] Columns         → opens picker
> 3
✓ Scope: table:public.users,public.orders (2 assets)
```

```text
> /analyze schedule show 4
Scope spec: column:public.users.email,public.users.first_name
Profile:    prod-pg
Next fire:  2026-05-14 03:00 UTC
```
