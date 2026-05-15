# Audit

`/audit` is the post-apply timeline — a chronological view of every
comment AMX has written to a database. It's the surface you point a
reviewer or auditor at when the question is "what changed, who did it,
and when?"

## Filters

Three filters above the timeline (sticky):

- **Identity** — `All` / `Mine` (current user + hostname) / `Others`.
  Useful in shared-history-store setups where multiple maintainers can
  apply.
- **Run ID** — scope the timeline to a single run's applies.
- **DB profile** — scope to one profile when the shared history covers
  more than one.

## Timeline

Events are grouped by day with sticky day headers — `Today`,
`Yesterday`, `Mon, Apr 28`. Within each day, rows render newest-first.

Each row shows:

- **Asset path** — schema.table.column
- **Before → After diff** — the prior comment on the left (italic and
  greyed when there was no prior comment), the new comment on the right
  in accent colour
- **Author chip** — username + hostname, e.g. `alice@laptop-1`
- **Attribution** — DB profile + Run ID. The Run ID is clickable to the
  [Run detail](run-detail.md) page
- **Timestamp** — HH:MM local time

Rows are expandable for the full diff view when the description is
long.

## Polling

The timeline polls every 30 seconds and re-fetches on window focus, so
CLI `/apply` events from other machines / users show up without a
manual refresh.

## Identifying who applied a comment

When the run wasn't pre-attributed (older runs from before the
attribution field was added), the row falls back to a system author
label. The Audit page surfaces this consistently so a reviewer can tell
authored-by-a-user from authored-by-an-imported-run.

## CLI equivalents

| Studio | CLI |
|---|---|
| Audit timeline | `/history events` (older entries) and `/history results <run_id>` |
| Identity filter | Filter on the user / hostname columns in the SQLite store |
| Rollback an entry | `/history rollback <run_id>` |
