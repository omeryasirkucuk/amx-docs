# Team setup

When more than one person uses AMX against the same warehouse, you want to share two
things: which descriptions have already been drafted (so people don't repeat work) and
the audit trail of who applied which description when. The mechanism for both is the
**shared history store** — an AMX-managed audit table inside one of your existing
databases. This page walks through enabling it from the lead's machine, onboarding
team members, and verifying everyone sees the same history.

## Prerequisites

- AMX installed on every team member's machine (`pip install amx-cli`).
- A database where the audit table can live. PostgreSQL is the recommended host
  (it supports the row-level UPDATE the audit table needs); MySQL, SQL Server,
  Snowflake, BigQuery, Databricks, and Redshift also work. ClickHouse and DuckDB do
  not — see [Shared history store](shared-history-store.md) for the reason.
- Each team member has their own active LLM profile (cost is per-user; it's fine to
  share a service-account API key, but cleaner to issue one key per user).
- Network connectivity from every team member to the host database.

## Step-by-step

### 1. (Lead) Pick the host backend

```text
[lead]> /db-profiles
default        prod-pg          dev-snowflake

[lead]> /history-store
History store currently: disabled (per-user local file at ~/.amx/history.db).

To enable shared history, pick a DB profile that will host the audit table.
Recommended: pick a 'sandbox' / 'metadata' database that all team members can reach.

  [1] default       (postgresql) localhost/postgres
  [2] prod-pg       (postgresql) db-prod.eu-west-1.rds.amazonaws.com/analytics
  [3] dev-snowflake (snowflake)  xy12345.eu-west-1/DEV
> 2

Schema name for the audit table (default: AMX): AMX
✓ Will create AMX.amx_history_runs / amx_history_results in db-prod...analytics
```

The lead picks once; everyone else points at the same backend by name.

### 2. (Lead) Create the audit tables

```text
[lead]> /history-store enable
About to create:
  CREATE SCHEMA IF NOT EXISTS AMX;
  CREATE TABLE AMX.amx_history_runs (...) ;
  CREATE TABLE AMX.amx_history_results (...) ;
  CREATE INDEX ix_amx_history_results_run_id ON AMX.amx_history_results(run_id) ;
  CREATE INDEX ix_amx_history_results_target ON AMX.amx_history_results(target_qname) ;

Proceed? [y/N]: y

✓ History store enabled. Future /run / /apply will write to AMX.amx_history_*.
```

The lead's `~/.amx/config.yml` now has:

```yaml
history_store_enabled: true
history_store_profile: prod-pg
history_store_schema: AMX
```

### 3. (Team member) Reuse the lead's history store

Each team member adds the same DB profile to their own AMX (read-only credentials are
fine — the audit table needs `INSERT` and `UPDATE` on the AMX schema only) and points
their config at it:

```text
[member]> /add-db-profile
> postgresql
Database host (e.g. db.example.com): db-prod.eu-west-1.rds.amazonaws.com
... (rest of wizard)

[member]> /history-store
History store currently: disabled.

> /history-store enable --profile prod-pg --schema AMX
✓ History store now points at: AMX.amx_history_* in db-prod.../analytics.
```

The `--profile` flag re-uses the existing profile rather than running a new wizard.

### 4. Verify everyone sees the same history

```text
[member]> /history list
run_id                            who              when               scope        ok    fail
run_2026-05-03_15-44-002          alice@acme.com   2 hours ago        sales        1219  0
run_2026-05-03_14-12-001          bob@acme.com     4 hours ago        catalog      47    0
run_2026-05-03_11-08-001          alice@acme.com   7 hours ago        sales (1 t)  18    0
...
```

The `who` column is the OS user (or, if `AMX_USER` env is set, that override). All
team members see all runs.

### 5. Recommended division of work

Once the history store is shared, here's the workflow that works:

- **Lead** runs whole-warehouse `/run-apply --profiling-mode metadata` once a quarter to seed first-draft descriptions for every column.
- **Domain owners** pick up specific schemas in their area and run `/run sales --review-all` to refine the descriptions interactively.
- **Reviewers** spot-check via `/history show <run-id>` and edit via `/run review`.
- **Anyone** can `/ask` with confidence — the catalog has been built across everyone's contributions.

`/history compare` is invaluable in the multi-person case — when two people produced
different descriptions for the same column, compare runs side-by-side:

```text
> /history compare run_2026-05-03_15-44-002 run_2026-05-03_11-08-001 --filter sales.customer
                                  alice (2 hr ago)        bob (5 days ago)         status
sales.customer.c_first_name      "Given name of …"        "First name of …"        diff
sales.customer.c_last_name       "Surname of …"           "Surname of …"           same
sales.customer.x_legacy_status   "Legacy status flag …"   (no description)         alice added
```

## Beyond the audit tables — shared catalog, lineage, and pages

`/history-store enable` does more than wire up the audit pair. It
also brings up a small cluster of **shared** tables that pool
team-wide context into the same host database:

| Table | What it shares |
|---|---|
| `catalog_entities` | The local catalog search index that AMX builds during `/sync` — schemas, tables, columns, their comments. |
| `shared_catalog_entities` | The merged view across every member's catalog contributions. Auto-backfills local rows into this table so every member sees every other member's synced asset. |
| `shared_lineage_artifacts` + `shared_lineage_edges` | Saved Lineage canvases and their nodes / edges. Open a canvas a teammate saved without an export step. |
| `shared_documentation_pages` (+ related sources/assets/versions) | Pages composed via [`/pages`](../cli/pages.md) and their full revision history. |
| `_amx_users`, `_amx_admin_audit`, `_amx_sessions` | The member registry and admin audit trail used by [`/admin`](../cli/admin.md). |

A background backfill task moves local rows from
`catalog_entities`, the local lineage store, and
`documentation_pages` into their `shared_*` counterparts on every
sync — there is no explicit "push to shared" step. The reverse
(reading shared rows on a member's machine) is automatic too:
Studio's Browse → Pages, the Lineage canvas's `Open saved` tile,
and `/ask` retrieval all merge local and shared sources without
the user having to pick.

## Concurrent-edit safeguards

A shared catalog means two members can land in the same edit
dialog at the same time. AMX uses **optimistic concurrency
control** to keep one member's draft from silently overwriting
another's. The shared lineage and pages tables carry a `version`
column and an `updated_at` timestamp:

- Every read returns the row plus its current version.
- Every save sends `version` back; the write succeeds only if the
  stored row still carries the same version.
- A losing save returns a 409 Conflict with the current row, so
  Studio can present a side-by-side diff and let the second
  editor merge or overwrite explicitly.

This is the same shape as standard `If-Match` HTTP semantics and
the same mechanism the Studio admin panel relies on for member
role edits.

## Membership and roles

Each member's first connection registers a `(username, hostname)`
row in `_amx_users` with the default **viewer** role. The very
first connection on a fresh workspace promotes to **admin**
automatically so the workspace always has at least one admin.
After that, `/admin promote` is the only way to add more — see
[`/admin`](../cli/admin.md) for the full surface (members
listing, promote / demote / revoke, audit log, session events).

The "writer" role gates write-side endpoints that mutate the
shared catalog — for example the
`POST /api/lineage/asset/ingest` endpoint that
[Native Databricks lineage](../studio/lineage.md#native-databricks-lineage)
calls on click-to-ingest. View-only members cannot mutate the
shared store through a curiosity click.

## Sample config

Lead's config (the one that creates the tables):

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    # ...

history_store_enabled: true
history_store_profile: prod-pg
history_store_schema: AMX
```

Team member's config (after re-use):

```yaml
db_profiles:
  prod-pg:                 # same name, same connection details, possibly different creds
    backend: postgresql
    # ...

history_store_enabled: true
history_store_profile: prod-pg
history_store_schema: AMX
```

## Verify

1. **Lead and member**: `> /history list` returns the same row count.
2. **Lead and member**: `> /history show <some-run-id>` returns identical content (down to the SHA-256 of the `descriptions` blob — `/history show --hash`).
3. **Member**: `> /db inspect` shows `AMX` as a schema with the two `amx_history_*` tables.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/history-store enable` fails with `permission denied for schema public` (PG) or equivalent on other backends | The DB user can't `CREATE SCHEMA` | Have the DBA pre-create the schema, then run `/history-store enable --schema AMX` (skips the CREATE) |
| Member's `/history list` is empty even after lead's run | Member's `history_store_enabled` is still `false` (config not reloaded) | `> /config reload` or restart AMX |
| `psycopg.errors.UndefinedTable: relation "AMX.amx_history_runs" does not exist` | Schema name mismatch (lead used `amx`, member configured `AMX`) | Postgres folds unquoted identifiers to lowercase; use the same case on both sides |
| `/history compare` shows `alice` and `bob` for the same person on different machines | `AMX_USER` not consistent with OS user | Set `AMX_USER=alice@acme.com` in shell init for predictable attribution |
| Member can `/run` but `/apply` fails with `permission denied` on the audit insert | Member's DB role lacks `INSERT` on `AMX.amx_history_*` | Grant `INSERT, UPDATE ON AMX.amx_history_runs, AMX.amx_history_results TO <member-role>` |
