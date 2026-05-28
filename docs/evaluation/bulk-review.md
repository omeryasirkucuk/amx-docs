# Bulk review

A `/analyze run` against a real warehouse typically produces hundreds of
candidate descriptions in one go. The bulk review surface is the cluster of
filters, sort options, and column-level controls that turn that into an
actually-reviewable list — without forcing the reviewer to scroll a
several-thousand-row table top-to-bottom.

This page documents the controls (Studio first, REPL parity below), what
counts as a "column-level" decision, and how `column_overrides` keep per-row
choices durable across re-runs.

## Where it lives

| Surface | Page |
|---|---|
| Studio | `/runs/:id` (Results tab) and `/pending` |
| REPL | `/analyze review` and `/history review <run_id>` |

## Filter / search / sort / group

The Studio Results tab and the `/pending` queue both ship the same toolbar:

- **Filter — status.** Multi-select chips: Accepted / Pending / Skipped /
  Edited / Restored. The default is Pending so the reviewer sees only rows
  that still need a decision.
- **Filter — confidence.** High / Medium / Low. Backed by the logprob
  thresholds (`/logprob-thresholds`); Low rows are usually where the LLM
  expects you to step in.
- **Filter — kind.** Table / Column / View / Materialized view, so a
  reviewer can blast through all column rows first and come back to the
  table-level prose later.
- **Search.** Free-text matches the asset path, the candidate description,
  and any prior comment. The match is fuzzy enough to land on
  `users.created_at` when you type `created`, and tight enough to surface
  only the relevant rows in a 4,000-row run.
- **Sort.** By asset path, by confidence, by alternative count, or by length
  of the candidate description (useful for spotting truncations).
- **Group.** Group rows by schema or by table. Group headers collapse so
  the reviewer can hide already-reviewed clusters and keep visual scope on
  the next batch.

Every filter / sort / group decision is encoded in the URL on the Studio
side, so a teammate can paste a link to "the Low-confidence rows on
sales.orders, sorted by description length" and land on the same view.

## Multi-select + bulk actions

Each row has a checkbox in the leftmost column; a header checkbox
toggles every visible row. Once at least one row is selected, the
header surfaces a **Selected: N** chip and a bulk-action menu:

- **Accept selected** — applies the AMX candidate as-is to every
  selected row.
- **Skip selected** — marks every selected row as skipped without
  touching the candidate.
- **Re-run selected** — fires a fresh draft for the selected rows
  (opens the same Re-Run modal documented on
  [Studio → Run detail](../studio/run-detail.md#rerun)).
- **Clear edits on selected** — drops any inline edits the reviewer
  made and reverts to the AMX candidate.

Selections are bound to the filtered set: pick "Pending + Low", check
the header box, and the action applies only to the rows that
matched the filter. A confirmation modal prints the row count and
the target DB before any mutation lands so a stray bulk Accept can
not destroy a thousand rows by accident.

## Keyboard navigation

The Studio Results tab is keyboard-drivable:

| Key | Action |
|---|---|
| `j` / `k` (or arrows) | Move row cursor down / up |
| `Enter` | Open the focused row's inline editor |
| `a` | Accept the focused row |
| `s` | Skip the focused row |
| `e` | Edit (open inline editor; same as `Enter`) |
| `1` / `2` / `3` | Pick alternative 1 / 2 / 3 for the focused row |
| `x` | Toggle multi-select on the focused row |
| `Shift + x` | Range-select between the cursor and the last toggled row |
| `n` / `p` | Next / previous page |
| `?` | Open shortcut cheatsheet |

The cheatsheet (`?`) is the canonical reference; the table above
is a snapshot of the most-used shortcuts.

In the REPL, `/analyze review` presents each row as a numbered picker:
type a number to pick a candidate description, `s` to skip the row, or
`o` to write your own text.

## Column-level review

Tables are reviewed in two layers:

1. **The table description.** One row at the top of the table's slice in
   the Results tab. Same affordances as any other row: accept, edit, skip.
2. **Each column.** Indented under the table row. Column rows carry the
   candidate description, confidence pill, and an **alternatives**
   carousel (`/n_alternatives`-controlled candidate count). The reviewer
   picks one with the number key, edits inline, or skips.

A skip on a single column does **not** invalidate the table description.
A skip on the table description does **not** invalidate column work below
it — the orchestrator keeps the two as independent rows in `run_results`,
so partial reviews are normal and the Pending queue reflects exactly what
hasn't been touched.

## `column_overrides` persistence

When a reviewer edits a column inline, AMX records the override in the run
row's `column_overrides` field. A subsequent `/rerun` (or the
[`Re-Run` button](../studio/run-detail.md)) reads the field and skips
those columns by default — the reviewer's chosen text wins. Pass
`--ignore-overrides` to re-draft from scratch when you explicitly want a
fresh attempt on every column.

The same field carries forward into `/analyze schedule` rows: a schedule
that was added with column-level picks persists the override block, so the
next fire re-uses it.

## Pagination

Studio paginates the Results tab at 100 rows per page; the page-size picker
goes 25 / 50 / 100 / 250. The pager surfaces total row count and a
"jump to page" input so a reviewer can resume on page 7 the next morning
without losing place. URL state again preserves the page across reloads.

`/pending` paginates the same way; the **Apply pending queue** button
applies *everything that matches the current filters* (not just the visible
page), with a confirmation modal that prints the row count and target DB
before any COMMENT lands.

## REPL parity

`/analyze review` walks the same set as a numbered picker, one row at a
time, surfacing the same candidate alternatives:

```text
> /analyze review

1/2,148  public.users.email      [Low]
  1) Email address of the registered user used for transactional notifications.
  2) Email address of the user account, used for password reset and notifications.
  3) Contact email captured at sign-up.

Type a number to pick a description, "s" to skip, or "o" to write your own.
```

`/history review <run_id>` is the post-hoc equivalent — same UI, but
re-opens an already-run pass for late edits. Edits there also write to
`column_overrides` so the row is durable across re-runs.

## Column-level compare

For a column reviewed across more than one run — a Pending row
from today next to the accepted description from a month ago, or
two Variations of the same column from a single run — the
**Compare** affordance opens a side-by-side dialog scoped to that
column. Each side shows:

- The candidate description (or accepted comment, depending on the
  source run's outcome).
- The confidence label and the alternative carousel for that run.
- The diff between the two texts, inlined with insertions and
  deletions highlighted.

Compare is reachable two ways:

- From the Results tab, multi-select two rows that share the same
  qualified column path; the bulk-action menu surfaces **Compare
  selected**.
- From the [Compare page](../studio/compare.md) header, narrow the
  scope to one column to land in the same view.

The diff respects the alternatives carousel — flipping between
alt 1 and alt 2 on either side updates the diff live, so the
reviewer can compare alternatives across runs without leaving the
dialog.

## Verify

1. In Studio Results, click **Filter → Pending + Low**, **Group by table** —
   the row count in the page header should drop to "(showing 47 of 2,148)".
2. Type a column name into Search; the visible rows narrow without a server
   round-trip.
3. Edit one column, navigate to `/runs/:id` Scope tab — the column should
   appear in the `column_overrides` block.
4. `/rerun <result_id>` from the REPL — confirm the column you edited
   is left alone and only the un-overridden columns get fresh drafts.
