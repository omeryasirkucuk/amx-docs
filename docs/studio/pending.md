# Pending

`/pending` is Studio's review queue — the staging surface for
descriptions that have been drafted (by `/run`, `/generate`,
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

## What's next

- [Audit](audit.md) — see what your applied changes look like.
- [Run detail](run-detail.md) — where drafts originate before they land
  in the queue.
