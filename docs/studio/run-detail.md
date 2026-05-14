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

### Variations from an alternative ✨

Every alternative on a multi-alt row carries a small ✨ trigger next
to its confidence badge. Click it to open the
[Variations](variations.md) modal — the chosen alternative is used as
a seed, and the new run is anchored on it under either `semantic`
(paraphrase) or `lexical` (shared vocabulary) mode. The new run
appears in `/history`; the source row carries an audit pointer back
to the seed via `parent_run_id` + `seed_alternative_id`. The trigger
is hidden when the row has fewer than two alternatives — nothing to
vary around.

### Scope

JSON editor showing the scope the run was submitted with — useful when
auditing why a particular asset wasn't covered.

### Settings

JSON editor showing the run's effective LLM settings — `n_alternatives`,
`temperature`, `prompt_detail`, `verbosity`, `batch_size`, `max_tokens`.
Frozen at run time so re-runs from this page reproduce the original
conditions unless explicitly overridden.

## ReRun

Single-item: click the ↻ button on a row. Multi-select: tick one or
more rows → click **Re-Run** in the toolbar. The dialog opens with:

- **Additional instructions** — a free-text addendum appended to
  the original prompt so the re-run sees the original DB / docs /
  code inputs *plus* your guidance.
- **Advanced LLM settings** (collapsed by default) — the same
  override panel that RunNew exposes. Edit any field to override
  the active LLM profile for this re-run only; leave a field at
  the profile default to inherit it. Fields exposed:

  - Generation: temperature, max output tokens, alternatives per
    column, column batch size, prompt detail, description
    verbosity, confidence signal, alternatives diversity mode
    (disabled when alternatives per column is 1), thinking budget.
  - Confidence thresholds: high, medium.
  - Cost overrides: input USD / 1M, output USD / 1M.

  See [Alternatives mode](../concepts/alternatives-mode.md) and
  [Confidence signals](../concepts/confidence-signals.md) for what
  each knob does.

When N > 1 items are selected the modal notes that defaults reflect
your active LLM profile and overrides apply uniformly to all
selected items.

The **Reset to profile defaults** link (visible once you've changed
at least one field) rewinds every Advanced field to the profile's
saved value in one click.

The original DB scope, database / catalog, and the **cached
first-run table profile** are all reused, so the re-run is
comparable to its source rather than a fresh shot. Cost amortises
across re-runs because the profiling step doesn't repeat. The saved
LLM profile on disk is never mutated — the override only affects
this single re-run job.

**CLI parity exception.** The CLI does not expose a per-run
`/rerun --alternatives-mode` (or `--confidence-signal`, etc.). The
single tactical exception is `/rerun --temperature` for diversity
nudges. The full override surface on the CLI side lives in the
interactive picker on `/run`; see
[CLI run-and-apply](../cli/run-and-apply.md). This asymmetry is
deliberate — scripted CLI invocations stay reproducible from
`config.yml` alone, while Studio's modal-based override is the
experimentation surface.

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
