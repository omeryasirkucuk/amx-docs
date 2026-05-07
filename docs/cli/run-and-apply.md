# `/run`, `/run-apply`, `/apply`

`/run` is the heart of AMX: it picks a scope, dispatches the Profile / RAG / Code
agents, drafts column descriptions with the LLM, and queues the results for an
interactive review. `/apply` writes the reviewed descriptions back to the database.
`/run-apply` runs both back-to-back. This page walks through every prompt, the live
progress display, the keystroke shortcuts in the review wizard, and how `/apply`
recovers from per-row errors.

## Prerequisites

- AMX installed.
- An active DB profile that passes `/connect`.
- An active LLM profile that passes `/llm test`.
- For `/apply`: the DB role has comment write-back privileges (see the per-backend page).

## Step-by-step

### 1. Pick a scope with `/run`

```text
> /run
Pick a scope:
  [1] database     — every schema, every table
  [2] schema       — every table in one schema
  [3] table        — one or more tables
  [4] column       — re-draft descriptions for specific columns only
> 2

Select schema(s) (space to multi-select, enter to confirm):
  [ ] public
  [x] sales
  [ ] catalog
  [ ] events
> [enter]

Select table(s) in sales (space to multi-select, "all" to take everything):
  [x] customer            (TABLE,  2,450,118 rows, no comment)
  [x] customer_address    (TABLE,  2,450,118 rows, no comment)
  [ ] inventory_daily     (TABLE, 45,318,234 rows, has comment)
  [ ] order_summary_mv    (MATERIALIZED VIEW, 18,234 rows, has comment)
> [enter]
```

Or skip the picker by passing the scope on the command line: `/run sales`,
`/run sales.customer`, `/run sales.customer.c_first_name`.

### 2. Watch the live progress

```text
[Profile] sampling 5,000 rows from sales.customer ...........  ok (1.2 s)
[Profile] sampling 5,000 rows from sales.customer_address ...  ok (1.4 s)
[RAG]     no document profile active — skipping
[Code]    no code profile active — skipping
[LLM]     drafting 36 column descriptions in 4 batches ......  in progress
          batch 1/4: customer (10 cols) ......  ok (3.1 s)
          batch 2/4: customer (8 cols) .......  ok (2.8 s)
          batch 3/4: customer_address (10 cols)  ok (3.0 s)
          batch 4/4: customer_address (8 cols)   ok (2.6 s)
✓ /run finished in 14.1 s. 36 columns drafted.
  Confidence: high 24 · medium 9 · low 3
  Review with /run review (or /apply to write back).
```

### 3. Review with the wizard keystrokes

```text
> /run review
36 columns drafted · high: 24 · medium: 9 · low: 3
Review row 1/3 (low confidence): sales.customer.x_legacy_status
  current: (no comment)
  draft 1: "Legacy status flag preserved during the 2018 migration; values 0–7 map to..."
  draft 2: "Internal numeric status code from the v3 system (deprecated 2018)..."
  draft 3: "Status flag — historical, retained for backward-compat with the v3 migration..."

  [A]ccept-1   [1] [2] [3] pick alt   [E]dit   [S]kip   [R]edo   [B]ack   [Q]uit
> 1
✓ Accepted draft 2 for sales.customer.x_legacy_status
```

| Key | Action |
|---|---|
| `A` | Accept draft 1 (the default — same as pressing `1`) |
| `1` / `2` / `3` | Accept that alternative |
| `E` | Open the draft in `$EDITOR` for hand editing; on save, it's accepted |
| `S` | Skip — leaves the row pending; you'll see it again next `/run review` |
| `R` | Redo — re-asks the LLM with a higher temperature; quick way to break out of a stuck draft |
| `B` | Go back to the previous row |
| `Q` | Quit the review (stays pending) |

By default the wizard walks **only `low`-confidence rows**; high and medium are
auto-accepted. Pass `--review-all` to walk every row regardless of confidence.

### 4. Apply with `/apply`

```text
> /apply
Pending in review queue:
  scope: sales.customer, sales.customer_address
  total: 36 column descriptions + 2 table descriptions
  apply via: COMMENT ON … (PostgreSQL)

Write 38 comment(s) to db-prod/analytics? [y/N]: y

[1/38]  COMMENT ON TABLE  sales.customer IS 'Master customer record …';      ok
[2/38]  COMMENT ON COLUMN sales.customer.c_customer_sk IS 'Surrogate key …'; ok
[3/38]  COMMENT ON COLUMN sales.customer.c_first_name IS 'Given name …';     ok
...
✓ /apply finished. 38/38 written. Audit trail: /history show run_2026-05-03_15-42-001
```

Errors don't roll the batch back — each row is its own statement. Failed rows are
re-listed at the end:

```text
✗ /apply finished with errors: 36/38 written, 2 failed.
  - sales.customer.legacy_blob: ERROR: must be owner of column legacy_blob
  - sales.customer.legacy_meta: ERROR: must be owner of column legacy_meta
  Re-run /apply after fixing privileges (the failed rows stay in the queue).
```

#### Dry-run preview

`amx /apply --dry-run` (AMX 0.13+) shows the exact `COMMENT ON …`
statement each pending row would execute without opening a write
transaction. The pending file is left untouched, so you can re-run
`/apply` for real after reviewing the preview.

```text
> amx /analyze apply --dry-run
Preview pending metadata writes (dry-run)

Pending comments
  Asset                                  Description
  sales.customer                         Master customer record …
  sales.customer.c_customer_sk           Surrogate key generated …

Dry-run: showing the SQL templates for 38 pending comment(s). No changes will be written.
  [1/38] COMMENT ON TABLE sales.customer IS :cmt
  [2/38] COMMENT ON COLUMN sales.customer.c_customer_sk IS :cmt
  …

✓ Dry-run complete: 38 comment(s) previewed. Pending file unchanged.
  Re-run /analyze apply (without --dry-run) to write.
```

`:cmt` is the parameter slot the live path binds the comment text
into — it's printed verbatim so the user-supplied string is never
inlined into a SQL literal in the preview output. Rows whose asset
kind the active backend can't accept (e.g. schema comments on
ClickHouse) surface as `(skipped — backend cannot accept this asset
kind)`.

The same preview is reachable from Studio via the
[**Preview SQL** button](studio.md#preview-sql) on the Pending page.

### 5. The shortcut: `/run-apply`

For one-shot warehouse sweeps where you've already validated the LLM profile:

```text
> /run-apply --filter '^stg_' --auto-accept-high --apply
[scope]  47 staging tables · 1,283 columns
[Profile] sampling 5,000 rows ... ok in 18 s
[LLM]    drafting 1,283 column descriptions in 64 batches ... ok in 102 s
[Review] auto-accepted 1,021 high · 198 medium · skipped 64 low (review later)
[Apply]  Write 1,219 comment(s) to db-prod/analytics?
         (--apply was passed, skipping confirmation)
[1219/1219] ok
✓ /run-apply finished in 142 s. Audit trail: run_2026-05-03_15-44-002
```

Re-review the 64 skipped low-confidence rows later with `/run review`.

## Sample config — defaults that act on `/run`

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    # ...
    profiling_mode: sampled
    profiling_sample_size: 5000

llm_profiles:
  openai-prod:
    provider: openai
    model: gpt-4o
    column_batch_size: 10
    n_alternatives: 3
    logprob_high: 0.85
    logprob_medium: 0.50
```

## Verify

1. `> /history list` — confirms the run landed in the audit trail.
2. `> /history show <run-id>` — per-row results, including which alternative was picked.
3. `> /db inspect` — `comment?` columns now show `yes` for the rows you applied.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/run` hangs at `[Profile] sampling …` | Warehouse cold-start (Snowflake/Databricks/BigQuery) | Wait — first sample wakes the warehouse; subsequent calls are fast. Or run `/db connect` first to pre-warm |
| All drafts low confidence | LLM profile isn't returning logprobs (reasoning models, some OpenRouter routes) | Switch to a chat model, OR loosen thresholds: `/logprob-thresholds 0.7 0.4` |
| Review wizard says `0 rows to review` after a run | All rows were `high` confidence and auto-accepted | Pass `--review-all` to force the wizard to walk every row anyway |
| `/apply` writes 0 of N rows, all "must be owner" | Role lacks comment-write privilege | See the per-backend page for the exact `GRANT` syntax |
| `/run-apply` finished but `/db inspect` still shows `comment?: no` | Catalog cache stale | `> /sync` to refresh the introspection cache |
| Low confidence on every column from a specific table | Table name / columns are very ambiguous (e.g. `t1`, `c_a`, `c_b`) | Add documentation context: `/add-doc-profile` for a folder of design docs, or `/add-code-profile` for the codebase that uses these columns |

## What's next

- [Ask & Search](ask-and-search.md) — `/ask` over the descriptions you just wrote.
- [History](history.md) — `/history compare` two runs side-by-side; useful when comparing two LLM models on the same scope.
- [Human-in-the-loop](../concepts/human-in-the-loop.md) — the design rationale behind the review wizard.
