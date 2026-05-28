# Pending

`/pending` is Studio's review queue — the staging surface for
descriptions that have been drafted (by `/run`,
`/rerun`, or hand-edits from [Browse](browse.md)) but not yet written
back to the database.

## Queue

The page is a single DataTable:

| Column | Notes |
|---|---|
| Asset | schema.table.column path, mono font |
| New description | Inline-editable text |
| Confidence | High / Medium / Low pill |
| Status | Checkbox: Unreviewed / Accepted / Skipped |
| Actions | Edit, Delete per row |

A search box above the table filters by asset path or description.

Below the table, a summary line: `N pending rows waiting for approval`.

**One entry per asset.** Triggering Re-Run or Variations on a
column that already has a queued pick replaces the prior entry —
the queue holds at most one entry per
`(schema, table, column, asset_kind)`. The Studio's run-detail
page reflects this with a cross-version lock: while v2 holds the
queue entry for an asset, v1's alternative buttons are
non-clickable. The descendant-aware *Apply pending queue (N)*
counter on the run-detail page tallies entries on v2 / v3 rows
too, so picks on any version contribute to the count.

## Toolbar actions

### Preview SQL

Opens a read-only modal showing the exact `COMMENT ON …` / `ALTER` /
`sp_addextendedproperty` statements AMX would execute against the target
database. This is a dry-run, so:

- Skipped rows appear in a separate "won't be applied" list
- Asset kinds the backend can't accept (e.g. view-column comments on
  some MySQL versions) are flagged with a short reason

You can't apply from the preview modal; it's strictly read-only.

### Apply pending queue

Opens a confirmation modal naming the row count and the target database.
On confirm, AMX runs the writes with per-row `SAVEPOINT` isolation (on
backends that support it), so one bad row doesn't poison the whole
batch.

Successful writes flow through to the [Audit](audit.md) timeline.

### Clear queue

Asks for confirmation, then drops every pending row without writing.
Useful when you're starting over.

## Inline edits

Click any description cell to enter edit mode. The current text becomes
a textarea; Save/Discard buttons appear; a toast confirms the save. The
edit lives in the queue — it doesn't write to the database until you
**Apply**.

## CLI equivalents

| Studio | CLI |
|---|---|
| Pending queue | `/review` (interactive picker) |
| Preview SQL | `/apply --dry-run` |
| Apply queue | `/apply` |
| Clear queue | `/review` and skip every row |
