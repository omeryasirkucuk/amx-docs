# System

`/system` is the operational dashboard. Five sticky sections in the
left sidebar (hidden on mobile, where they collapse into stacked cards):
Doctor, Token usage, Catalog, Team history, Maintenance.

## Doctor {#doctor}

A live view of the `/doctor` checks:

- Status summary — total checks, passed, failed, overall OK / Fail
- Per-check rows: name, status badge (pass / fail), detail message,
  remediation hint
- **Skip network** toggle — bypass live HTTP / SQL probes for an
  offline run
- **Re-run** button

CLI equivalent: `/doctor` (with optional `--skip-network`,
`--debug`). See [`/doctor`](../cli/doctor.md).

## Token usage {#token-usage}

The accounting surface for everything AMX has spent on LLM calls.

- **Window picker** at the top — Today / 24 h / 7 d / 30 d / All time
  (the selection is sticky across page visits)
- **Per-(provider, model) table** — Provider, Model, Runs, Input
  tokens, Output tokens, Total tokens, Cost (USD). Sortable, totals
  row at the bottom
- A `Counted N runs in this window` line below the table

Older runs that pre-date the live-pricing system contribute zero cost
in this view. Use the **↻** button in the top bar to refresh the
pricing cache; future runs will fold the up-to-date rates in.

CLI equivalent: `/usage [TODAY|24h|7d|30d|all]` and `/usage --live` to
recompute against current rates.

## Catalog {#catalog}

The status of the catalog index that backs Browse and `/ask`:

- Ready / not initialised
- Entity counts (schemas, tables, columns reachable in scope)
- Description counts and coverage %
- Index type (SQLite, Chroma)
- Refresh button — triggers a sync job

Active sync jobs render below as a small queue with per-job progress.

CLI equivalent: `/sync [--db-profile NAME…]` and `/rebuild`.

## Team history {#team-history}

The on/off toggle for the shared run-history backend:

- **Enabled** — every `/run`, `/run-apply`, and `/ask` is dual-written
  to a shared backend the team owns. Other maintainers' runs show up
  in [Runs](runs.md) and [Audit](audit.md)
- **Disabled** — local SQLite only (`~/.amx/history.db`)

A separate **Placeholder cleanup** button removes temporary placeholder
columns that some backends create during dry-runs.

CLI equivalent: `/history-store status / enable / disable /
migrate-from-local / flush-pending / dump-ddl`. See
[Shared history store](../collaboration/shared-history-store.md).

## Maintenance {#maintenance}

Backend-specific admin actions, surfaced when they're available for the
active profile (e.g. Databricks-only PAT rotation hints, MySQL
`information_schema` reload). The exact buttons here depend on the
profile in scope.

## What's next

- [Doctor (CLI)](../cli/doctor.md) — the same checks from the REPL.
- [Shared history store](../collaboration/shared-history-store.md) —
  full team-history walkthrough.
