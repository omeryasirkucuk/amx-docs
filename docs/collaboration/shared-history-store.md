# Shared history store

By default, AMX's run history is **per-machine** — your teammate cannot see runs you executed.
The shared history store is an optional dual-write that pushes every `/run`, `/run-apply`,
and `/ask` to a backend the team already owns, so two engineers running AMX against the
same warehouse can see each other's analyses.

## Mental model

- **Local SQLite is always the source of truth for reads.** `/history list` shows your
  machine's runs. Cross-machine read views are slated for a follow-up minor.
- **Shared mode dual-writes.** Every run/result/event lands in local SQLite first
  (always-on cache) and **best-effort** to the shared backend.
- **Failures don't block you.** When the shared backend is unreachable, the local row
  still lands and the failed write queues in `pending_shared_writes` for replay.

This is deliberately conservative: shared mode is a feature, not a dependency. Network
hiccups, warehouse maintenance, or a misconfigured profile never break a CLI session.

## Onboarding

Open the picker — the picker prints the current shared-mode status first, then shows a
context-aware menu:

```text
/db
/history-store
```

When shared mode is **off**, the menu is:

```text
1. Status — show shared-mode state and outbox depth   (default)
2. Enable — bootstrap an AMX schema on a saved DB profile
3. Dump DDL — print bootstrap SQL for a DBA to run by hand
4. Cancel — exit without doing anything
```

Pick **Enable**. The wizard:

1. Asks which saved DB profile to use (Postgres, Snowflake, Databricks, BigQuery, MySQL,
   Oracle, MSSQL, Redshift — see [supported backends](#supported-backends) below).
2. Asks for a schema name (defaults to `AMX`).
3. Issues backend-appropriate `CREATE SCHEMA IF NOT EXISTS` DDL.
4. Creates the AMX tables via SQLAlchemy `MetaData.create_all`.
5. Offers to migrate existing local rows up (idempotent — safe to re-run).
6. Saves the choice to `config.yml` (`history_store_enabled: true`,
   `history_store_profile`, `history_store_schema`).

When shared mode is **on**, the menu shifts to:

```text
1. Status
2. Disable
3. Migrate from local
4. Flush pending
5. Dump DDL
6. Cancel
```

## Direct CLI subcommands

Power users and scripts can invoke each action directly without the picker:

| Picker option | Click subcommand |
|---|---|
| Status | `amx db history-store status` |
| Enable | `amx db history-store enable [--profile P --schema S]` |
| Disable | `amx db history-store disable` |
| Migrate from local | `amx db history-store migrate-from-local` |
| Flush pending | `amx db history-store flush-pending` |
| Dump DDL | `amx db history-store dump-ddl [--profile P --schema S]` |

## What gets written

Four tables under the chosen schema (default `AMX`):

| Table | What it carries |
|---|---|
| `analysis_runs` | One row per `/run`, `/run-apply`, `/ask` |
| `run_results` | Per-column results (top description + alternatives + decision) |
| `app_events` | Profile switches, run status, apply outcomes |
| `session_state` | `/ask` conversation sessions |

Every shared row records:

- `created_by` — username
- `hostname` — the machine that ran AMX
- `client_version` — AMX version that wrote the row
- `local_id` — the SQLite INT id on the originating machine, for joining back

## Supported backends

Shared mode supports backends that can `UPDATE` rows (the dual-write coordinator needs
this for `finish_run` to land terminal status):

- PostgreSQL
- MySQL
- MSSQL
- Oracle
- Snowflake
- Databricks
- Redshift
- BigQuery

**Blocked at Enable time:**

- **DuckDB** — local file, not shared storage.
- **ClickHouse** — no row-`UPDATE` semantics.

The Enable wizard refuses these with a clear error listing the supported backends, gated by
the `BackendCapabilities.supports_shared_history` flag.

## Failure semantics

When the shared backend is unreachable:

1. Local SQLite write succeeds — your CLI session is never blocked.
2. The failed shared write queues in the local `pending_shared_writes` outbox.
3. **Status** shows the outbox depth so you know there's pending work.
4. **Flush pending** replays queued writes.

You can also `disable` shared mode at any point — existing shared rows are not deleted.

## Safety guards

The shared store is a multi-engineer surface. AMX adds three guards on top:

1. **Cross-profile session resume is refused.** A `/ask` session from `prod_pg` cannot be
   resumed against `dev_snowflake`.
2. **The picker confirms destructive actions.** Disable, Flush pending, and Dump DDL
   all confirm before doing anything.
3. **Every shared row carries attribution.** `created_by`, `hostname`, `client_version`,
   `local_id` — so the team can answer "who ran this?".

See [Safety guards](safety-guards.md) for the full list.

## Reads still come from local

In v0.12, **reads still come from local SQLite**. `/history list` shows runs from your
machine, not the shared store. Cross-machine read views (e.g. "show me everyone's runs
against `prod_pg`") are slated for a follow-up minor.

This is a deliberate staging — it keeps `/history list` fast (no network round-trip) and
lets the team validate write semantics before exposing the shared view.

## Configuration

The relevant `config.yml` keys (all optional, schema v2):

```yaml
schema_version: 2
history_store_enabled: true
history_store_profile: prod_pg
history_store_schema: AMX
```

Existing 0.11.x configs load unchanged — the schema bump is additive. If an older AMX
binary tries to read a 0.12+ config, it raises `ConfigSchemaTooNewError` with an upgrade
prompt rather than silently mangling the file.

## See also

- [Team setup](team-setup.md) — recommended workflow for onboarding a team.
- [Safety guards](safety-guards.md) — the three guards listed above, in detail.
- [`/history`](../cli/history.md) — read interface for run history.
