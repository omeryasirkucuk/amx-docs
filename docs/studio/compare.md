# Compare

`/runs/compare` pivots 2–4 runs side-by-side. Use it to answer "did my
new prompt actually help?" or "which model produced better descriptions
on this schema?"

## Picker

The left side of the page is a Compare picker:

- Filterable list of recent runs (page-size dropdown for 10 / 20 / 50 /
  100 rows)
- Kind chips: Analyze / Rerun / Generate / Ask / All (defaults to
  whatever filter you last used on the [Runs list](runs.md))
- Search box for filtering by command or scope
- Per-row checkbox; the **Compare** button activates once 2 are selected
  and caps at 4

Each row card shows the command chip (coloured by kind), run ID, scope,
status, model, duration, cost, and approval rate, so you can pick a
matched pair without re-opening each run.

## Compare grid

Right side, opens when you click **Compare** with a valid selection.

### Aggregate metrics row

A row of per-run cards across the top of the grid surfaces:

- Wall duration (s)
- Model processing time (s)
- Prompt tokens, completion tokens, total tokens
- Cost (USD)
- Average logprob
- % high / medium / low confidence
- Approval rate

A **winner ring** (subtle accent border) highlights the best run per
metric — fastest, cheapest, highest approval, highest confidence. The
winner is computed per metric independently; the same run can win
duration but lose approval rate.

### Per-column comparison

Below the aggregate row, a per-asset table shows every asset touched by
any of the selected runs. Columns are arranged left-to-right by run:

| Asset | Run A | Run B | Run C |
|---|---|---|---|
| schema.table.column | description, confidence, logprob, status | … | … |

Cells are clickable — drill into the corresponding [Run detail](run-detail.md)
row, or edit inline.

#### Stacked versions per cell

When a run had Re-Run or Variations triggered against one of its
assets, the descendant rows render **inline under the v1 cell** in
the same column. The v1 description shows first with a small `v1`
chip; v2 / v3 / … descendants stack below it with a left-border
accent and their own `v2` / `v3` chip. A descendant whose
`alternatives_mode` is `lexical` carries a compact `L` chip
(tooltip: *lexical — same vocabulary, distinct candidate
meaning*); `semantic` carries an `S` chip (tooltip: *semantic —
paraphrase of the seed*). The seed text is also surfaced on the
chip tooltip for Variations descendants so you can see at a glance
which alternative the variation was anchored on.

Per-version mode chips inline beneath the cell describe each
descendant's own mode. The mode chip in the column header above
continues to reflect the parent run's v1 mode — descendant modes
can diverge from the parent (a `semantic` run can spawn a
`lexical` variation), and the per-version chips make that
divergence visible without you having to navigate into the
descendant run.

The winner ring (the highlighted cell with the highest logprob)
still compares v1's logprob across runs; descendants are
peer-rendered to v1 rather than competing for the winner
highlight. See [Variations](variations.md) for how descendants
are generated.

## Ask AMX hand-off

The **Ask AMX** button above the grid closes the comparison and opens
[`/ask`](ask.md) with a pre-seeded prompt that names the selected runs.
The chat agent has a `compare_runs` tool that answers follow-up
questions like "why did run 58 do better on the address table?" without
forcing you back to this page.

## CLI equivalents

| Studio | CLI |
|---|---|
| Compare grid | `/history compare [--last N] [run_ids…] [--by DIMENSION]` |
| Ask AMX hand-off | `/ask "compare runs 58, 59"` |

## What's next

- [Ask](ask.md) — the chat surface the Ask AMX button opens.
- [Run detail](run-detail.md) — drill into a single run.
