# Run detail

`/runs/:id` is the deepest review surface in Studio. It has two display
modes:

- **Live stream** (`/runs/new-:jobId`) — Server-Sent-Events from the
  worker. Auto-redirects to `/runs/:id` once `run.created` fires.
- **Historical** (`/runs/:id`) — Persisted run record. The default view
  once a run has finished.

Both modes share the same tabbed layout once the run has emitted its
first persisted row.

## Live progress banner

While a worker is still alive, a sticky banner at the top of the page
shows:

- **Elapsed timer** — wall-clock seconds since the run started.
- **Current activity** — e.g. `Processing public.users (2 / 156 columns)`.
- **Batch progress** — column N of M.
- **Live cost** — USD spent so far, updating per batch.
- **Cancel button** — sets the cancel token; the worker stops between
  rows (not mid-row).

The banner disappears once the run reaches a terminal status (Success /
Failed / Cancelled).

## Tabs

### Summary

Run metadata: command, status, duration, started-at. Below:

- **Scope card** — JSON representation of what was submitted.
- **Tokens & cost card** — input tokens, output tokens, total tokens,
  cost at run time, cost at current rates.
- **LLM reasoning** — when the provider returned a reasoning trace
  (Anthropic extended thinking, GPT-5 / o-series, DeepSeek-reasoner,
  Kimi K2.x), it is rendered here instead of being discarded.
- **Confidence distribution** — pie / bar chart of high / medium / low
  confidence counts when the run produced more than a handful of rows.

### Results

The main review surface. Paginated at 50 rows per page.

A **ResultsFilterBar** above the table exposes:

| Control | Effect |
|---|---|
| Search box | Debounced 300 ms substring match on schema / table / column / comment |
| Sort dropdown | Natural order, confidence asc/desc, logprob asc/desc, name A→Z, status (unreviewed first) |
| Group dropdown | None, Schema, Table |
| Status chips | All, Unreviewed, Accepted, Skipped — with per-status counts |
| Review presets | Low confidence (<0.7), Has citations, Table-level only |

The DataTable shows one row per asset (schema.table.column). Each row
exposes:

- **Checkbox** for multi-row selection (used by the ReRun action)
- **Asset path** — schema.table.column, mono
- **Asset kind** — column / table / view
- **Confidence pill** — high / medium / low plus a logprob badge when
  available
- **Source** — rag / provided / function / other
- **Alternatives count** — number of additional drafts generated for
  this asset
- **Description** — the chosen draft, inline-editable
- **Status** — Unreviewed / Accepted / Skipped
- **Actions** — Pin, Skip, Restore (for re-runs)

Expandable per-row sections show alternatives (with a one-click "promote"
button on each), citations with snippet previews, the model's reasoning,
and the version history when this row has been re-run.

### Scope

JSON editor showing the scope the run was submitted with — useful when
auditing why a particular asset wasn't covered.

### Settings

JSON editor showing the run's effective LLM settings — `n_alternatives`,
`temperature`, `prompt_detail`, `verbosity`, `batch_size`, `max_tokens`.
Frozen at run time so re-runs from this page reproduce the original
conditions unless explicitly overridden.

## ReRun

Multi-select one or more rows → click **Re-Run** in the toolbar. The
dialog lets you adjust:

- Verbosity
- Temperature
- Alternatives count
- Free-text instructions

The original DB scope, database / catalog, prompt detail, and the
**cached first-run table profile** are all reused, so the rerun is
comparable to its source rather than a fresh shot. Cost amortises
across re-runs because the profiling step doesn't repeat.

## Pinned cells

Every row has a **Pin** button. Pinning persists to `localStorage` under
`amx.compare.pinnedCells.<profile>` and pushes a custom
`amx:pinned-cells-changed` event so the topbar pin counter and the
pinned-cells drawer stay in sync across tabs.

Pinned cells survive page navigation. They're useful for keeping a
candidate set in view while you ReRun, compare, or apply individual
rows.

## CLI equivalents

| Studio | CLI |
|---|---|
| Run detail Summary tab | `/history show <run_id>` |
| Run detail Results tab | `/history results <run_id>` |
| ReRun | `/rerun <run_id>[.schema.table.column]` |
| Skip / Restore | `/review <run_id>` interactive picker |
| Apply pending | `/apply` |

## What's next

- [Pending](pending.md) — the queue accepted rows land in before they
  write to the database.
- [Compare](compare.md) — pivot multiple runs side-by-side.
- [Audit](audit.md) — see what your applied changes look like in the
  timeline.
