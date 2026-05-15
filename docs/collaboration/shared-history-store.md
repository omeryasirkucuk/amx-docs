# Shared history store

By default, AMX's run history is **per-machine** — your teammate cannot see runs you
executed and vice versa. The shared history store moves the audit table from the local
SQLite file at `~/.amx/history.db` to two real tables inside one of your existing
databases, so every team member sees every run, every reviewed description, and the
provenance of every applied comment. This page walks through the schema, the DDL AMX
emits, the enable / disable / migrate operations, and how to recover when machines fall
out of sync.

## Prerequisites

- AMX installed.
- A backend that supports row-level UPDATE (so AMX can mark runs as applied):
  PostgreSQL, MySQL/MariaDB, SQL Server, Snowflake, BigQuery, Databricks, Oracle,
  Redshift. **ClickHouse and DuckDB are not supported** — they cannot UPDATE single
  rows transactionally.
- A DB user that can `CREATE SCHEMA` (or someone with that privilege to pre-create it
  for you), and `INSERT` / `UPDATE` on the resulting tables.
- An active DB profile pointing at the host database.

## Schema

Two tables in a dedicated schema (default name `AMX`):

```sql
CREATE TABLE AMX.amx_history_runs (
  run_id        TEXT       PRIMARY KEY,         -- e.g. run_2026-05-03_15-44-002
  who           TEXT       NOT NULL,            -- AMX_USER or OS user
  started_at    TIMESTAMP  NOT NULL,
  finished_at   TIMESTAMP,
  scope         TEXT       NOT NULL,            -- e.g. "sales", "sales.customer", "sales.customer.col"
  llm_provider  TEXT       NOT NULL,
  llm_model     TEXT       NOT NULL,
  db_backend    TEXT       NOT NULL,
  state         TEXT       NOT NULL,            -- running | reviewed | applied | failed
  applied_at    TIMESTAMP,
  applied_by    TEXT,
  metadata_json TEXT                            -- arbitrary JSON: flags, sample sizes, etc.
);

CREATE TABLE AMX.amx_history_results (
  run_id          TEXT     NOT NULL,            -- FK to amx_history_runs.run_id
  target_qname    TEXT     NOT NULL,            -- e.g. sales.customer.c_first_name
  target_kind     TEXT     NOT NULL,            -- TABLE | COLUMN | VIEW | MATERIALIZED_VIEW
  description     TEXT,
  alternatives    TEXT,                         -- JSON array of {text, logprob}
  confidence      TEXT     NOT NULL,            -- high | medium | low
  applied         BOOLEAN  NOT NULL DEFAULT 0,
  applied_at      TIMESTAMP,
  PRIMARY KEY (run_id, target_qname)
);

CREATE INDEX ix_amx_history_results_run_id  ON AMX.amx_history_results (run_id);
CREATE INDEX ix_amx_history_results_target  ON AMX.amx_history_results (target_qname);
```

DDL is dialect-translated per backend — the connector adapts `BOOLEAN` / `TIMESTAMP` /
`TEXT` to native types. This snippet is the PostgreSQL form.

## Step-by-step

### 1. Enable

```text
> /history-store
History store currently: disabled (per-user local file at ~/.amx/history.db).

To enable shared history, pick a DB profile that will host the audit table.
Recommended: pick a 'sandbox' / 'metadata' database that all team members can reach.

  [1] default       (postgresql) localhost/postgres
  [2] prod-pg       (postgresql) db-prod.eu-west-1.rds.amazonaws.com/analytics
  [3] dev-snowflake (snowflake)  xy12345.eu-west-1/DEV
> 2

Schema name for the audit table (default: AMX): AMX

> /history-store enable
About to create:
  CREATE SCHEMA IF NOT EXISTS AMX;
  CREATE TABLE AMX.amx_history_runs (...);
  CREATE TABLE AMX.amx_history_results (...);
  CREATE INDEX ix_amx_history_results_run_id ON AMX.amx_history_results(run_id);
  CREATE INDEX ix_amx_history_results_target ON AMX.amx_history_results(target_qname);

Proceed? [y/N]: y

✓ History store enabled. Future /run / /apply will write to AMX.amx_history_*.
```

### 2. Migrate local history (one-shot)

```text
> /history-store migrate-from-local
Found 47 runs in ~/.amx/history.db. Copy to AMX.amx_history_*? [y/N]: y

[1/47] run_2026-04-15_09-12-001 ............  ok
[2/47] run_2026-04-15_10-04-002 ............  ok
...
[47/47] run_2026-05-03_15-44-002 ............  ok
✓ /history-store migrate-from-local finished. 47 runs imported.

Local file ~/.amx/history.db kept (not deleted) — remove it manually after verifying.
```

The copy is **idempotent** — re-running skips rows that already landed in the
shared schema, so partial failures are safe to retry. The local file is kept
on purpose; verify with `/history list`, then `rm ~/.amx/history.db` once
you're satisfied.

### 3. Pull teammates' rows into local cache

```text
> /history-store pull-from-shared
Pulling shared rows newer than 2026-05-03_15-44-002 (your last local row)…
[1/12] run_2026-05-04_08-10-001 (alice@laptop) ......  ok
...
[12/12] run_2026-05-12_17-22-004 (bob@desktop) .......  ok
✓ /history-store pull-from-shared finished. 12 rows added to local cache.
```

Use this when you want a `/history list` that includes teammates' runs even
when offline. The shared store remains authoritative; the local cache is
write-through, never write-back.

### 4. Disable (back to local-only)

```text
> /history-store disable
About to switch back to per-user local file (~/.amx/history.db). Existing rows in
AMX.amx_history_* will NOT be deleted; they're just no longer the active store.

Proceed? [y/N]: y
✓ History store disabled. /history now reads ~/.amx/history.db.
```

### 5. Flush the dual-write outbox

```text
> /history-store flush-pending
Outbox depth: 7 rows queued for shared write (last attempt 12m ago).

[1/7] run_2026-05-13_14-22-003.results ....  ok
[2/7] run_2026-05-13_14-22-003.update  ....  ok
...
[7/7] run_2026-05-13_14-30-001.results ....  ok
✓ /history-store flush-pending finished. Outbox is empty.
```

`flush-pending` retries dual-writes that failed at write time (DB unreachable,
permission blip, etc.) — it does **not** drop any tables. The local SQLite file
is the source of truth for the outbox queue, so re-running drains whatever is
queued without re-writing already-mirrored rows.

### 6. Dump the bootstrap DDL

```text
> /history-store dump-ddl
-- AMX history-store bootstrap DDL (PostgreSQL dialect)
CREATE SCHEMA IF NOT EXISTS AMX;
CREATE TABLE AMX.amx_history_runs (...);
...
```

Use this when your DBA needs to pre-create the schema and tables by hand
(e.g. permissions don't allow AMX itself to `CREATE SCHEMA`). The DDL is
dialect-translated for the active DB profile's backend.

## Multi-machine sync — what to expect

| Action on machine A | Visible on machine B after |
|---|---|
| `/run` (creates run row) | Immediately (next `/history list` call) |
| Review wizard (updates rows) | After `/history sync` on B (or B's next `/history list`) |
| `/apply` (sets `applied=1`) | Immediately on B |
| Local edit to `~/.amx/history.db` | Never — the local file is no longer authoritative |

The store doesn't push notifications — it's pull-based. `/history list` does a SELECT
each time, so all team members see fresh state on every call.

## Sample config

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    host: db-prod.eu-west-1.rds.amazonaws.com
    port: 5432
    user: amx_history_writer
    password: keyring://amx/prod-pg/password
    database: analytics

history_store_enabled: true
history_store_profile: prod-pg
history_store_schema: AMX
```

## Verify

1. `> /history-store status` — confirms the active store (file vs shared), profile name, schema name.
2. `> /history list --limit 5` — confirms recent runs are visible.
3. (On a second machine after enabling) `> /history list` returns the same rows.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/history-store enable` fails with `CREATE SCHEMA` permission denied | DB user can't create schemas | Have the DBA create the schema (`CREATE SCHEMA AMX;`), then `/history-store enable` (it will detect the existing schema and skip the CREATE) |
| `external_history_store_unsupported` error | Profile points at ClickHouse or DuckDB | Pick a different host backend (PostgreSQL is the default recommendation) |
| Two machines see different rows for the same run | One machine has `history_store_enabled: false` and is using the local file | `> /config show | grep history_store` on both; ensure both are `true` and pointing at the same profile |
| `permission denied for relation amx_history_results` mid-`/apply` | DB user has SELECT but not INSERT/UPDATE on the audit tables | `GRANT INSERT, UPDATE ON AMX.amx_history_* TO <user>;` |
| Slow `/history list` on a large team (1000+ runs) | Index missing or stale stats | `ANALYZE AMX.amx_history_runs; ANALYZE AMX.amx_history_results;` |
| `/history-store migrate-from-local` fails partway through | Local SQLite file has a row that violates a NOT NULL constraint in the new schema | The migration is idempotent; re-run with `--skip-errors` to skip the bad row, then inspect `~/.amx/history.db` for the offender |
| Outbox depth keeps climbing in `/history-store status` | Shared DB intermittently unreachable so dual-writes queue without being drained | `/history-store flush-pending` once the DB is healthy; consider a daemon-side `pull-from-shared` cron if the gap is persistent |
