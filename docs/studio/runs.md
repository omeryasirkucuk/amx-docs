# Runs

`/runs` lists every recorded run across every command kind — `/run`,
`/run-apply`, `/generate`, `/rerun`, `/ask`, and scheduled invocations.
It is the entry point for inspecting a finished run, picking runs to
[Compare](compare.md), or cancelling a run that's still in flight.

## Kind filter

A row of chips above the table filters by command kind:

| Chip | Includes |
|---|---|
| **Analyze** | `/run` and `/run-apply` |
| **Re-run** | `/rerun` invocations |
| **Generate** | `/generate` single-shot drafts |
| **Ask** | `/ask` chat turns persisted as runs |
| **Schedule** | Daemon-fired scheduled runs |
| **All activity** | Everything (no filter) |

The selected chip persists to `localStorage`, so the next visit defaults
to the same filter. **Analyze** is the default for a fresh browser.

## Table columns

The DataTable shows:

| Column | Notes |
|---|---|
| **ID** | `#123`, mono font |
| **Command** | Humanised: analyze / rerun / generate / ask / schedule |
| **Scope** | Summary of selected scope — `public.users, public.orders` |
| **Status** | Pill: Success / Failed / Running / Cancelled / Ready for review |
| **Duration** | Wall-clock seconds |
| **LLM model** | Short model name |
| **DB profile** | Profile that owned the run |
| **Started** | Relative time, e.g. "3 hours ago" |
| **Actions** | **Cancel** button on running rows |

Every row is clickable to [Run detail](run-detail.md). Sort defaults to
`started_at` descending. Non-critical columns hide on mobile.

## Compare entry point

A **Compare** action above the table opens the Compare picker. Pick 2–4
runs from the same scope (or different scopes — the grid handles
both) → [Run detail comparison](compare.md).

## Running runs and cancellation

A run whose status is **Running** shows a small spinner next to the ID.
The Actions column on that row exposes a **Cancel** button that sets the
worker's cancel token; the run stops between rows (not mid-row), so
expect a short tail before the status flips to **Cancelled** and the
spinner disappears.

The live-progress card on the [Run detail](run-detail.md) page shows the
same Cancel button while you're watching a run.

## New run

A `+ New run` button (top right) opens the inline scope picker on
`/runs/new`:

- Multi-select DB profile chips
- Cascading database / catalog selector (auto-picks the only option when
  there's just one)
- Scope tree: schema → table → column with additive selection (ticking
  deeper narrows the scope, unticking widens it back to "everything
  below")
- LLM profile dropdown
- Apply / generate option

Submitting the form spawns a background run. The page auto-redirects to
the live `/runs/new-:jobId` route, which converts to the persisted
`/runs/:id` URL the moment the worker emits `run.created`.

## CLI equivalents

| Studio | CLI |
|---|---|
| Runs list | `/history list [-n N] [--include-asks]` |
| Cancel a running run | `Ctrl-C` in the REPL during the run |
| `+ New run` button | `/run <scope>` |
| Compare | `/history compare` |
