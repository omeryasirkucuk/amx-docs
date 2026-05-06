# Human in the loop

The review wizard sits between agent output and the database. AMX never writes a generated
description to your database without a human decision (or an explicit `--apply`).

## Why it exists

LLM-generated metadata is wrong sometimes. Even at high confidence the model can confidently
hallucinate a foreign-key relationship that isn't there, or invent business semantics for a
column that's actually a synthetic surrogate. The cost of letting that into the live database
is permanent — once `COMMENT ON COLUMN` lands, it propagates to every catalog tool that
syncs from your information schema.

The review wizard makes the hand-off explicit:

- **Per-column decision** — accept, pick alternative, write your own, skip.
- **Provenance visible** — every suggestion shows the evidence behind it (DB profile, code
  references, doc snippets).
- **Confidence calibrated** — logprob-driven `high` / `medium` / `low` bands so you can scan
  high-confidence rows quickly and slow down on the rest.
- **Bulk-accept gated** — only accepts at or above the configured `high` threshold, never
  blindly.

## The review flow

For each column AMX shows:

```text
sap_s6p.t001.audat — column 7 of 17

  ▶ Document date. Calendar date the source business event was recorded;
    distinct from posting date (BUDAT) which controls the accounting period.
    confidence: high · logprob: 0.91 · sources: code (3 refs), docs, profile

  Alternatives:
    2. Audit date. Timestamp of the most recent audit run on this row.
       confidence: low · logprob: 0.42 · sources: profile only
    3. Document creation date. Same as ERFDAT in adjacent SAP tables.
       confidence: medium · logprob: 0.66 · sources: docs

  [A]ccept  [1-3] Pick alternative  [W]rite your own  [S]kip  [Q]uit
```

Decisions:

- **Accept** writes the top suggestion to the staging area for `/apply`.
- **Pick alternative** swaps in alternative N as the staged description.
- **Write your own** drops you into a multi-line editor; whatever you type is staged.
- **Skip** records that you reviewed this column and chose not to comment it. AMX will not
  re-suggest unless you explicitly re-run the column.
- **Quit** ends the review without losing what you've already accepted.

## Bulk accept

For schemas with hundreds of columns, manual review per column is impractical. Bulk accept:

- Pre-filters to columns whose top suggestion has logprob ≥ the `high` threshold.
- Shows you the count and a sample before doing anything.
- Accepts them in one batch, leaving lower-confidence columns for manual review.

The threshold is per-LLM-profile, configurable via `/llm-thresholds`.

## Apply

`/apply` writes every staged accepted description to the live database via that backend's
native comment mechanism:

- PostgreSQL: `COMMENT ON COLUMN`
- Snowflake: `COMMENT`
- Databricks: `COMMENT ON COLUMN` (Unity Catalog SQL warehouse)
- BigQuery: `ALTER … SET OPTIONS(description=…)`
- MySQL: `ALTER TABLE … MODIFY COLUMN … COMMENT '…'`
- Oracle: `COMMENT ON COLUMN`
- SQL Server: `sp_addextendedproperty` / `sp_updateextendedproperty`
- Redshift: `COMMENT ON COLUMN`
- ClickHouse: `ALTER TABLE … MODIFY COMMENT` (21.x+)
- DuckDB: `COMMENT ON COLUMN`

Each adapter advertises capability flags so unsupported operations fail clearly instead of
being counted as applied.

## Auditability

Every decision is recorded in `~/.amx/history.db`:

- `analysis_runs` — the run scope, profiles, model, duration.
- `run_results` — per-column final decision (accepted / alternative-N / custom / skipped),
  the description that landed, and the LLM-generated alternatives.
- `app_events` — the apply outcome (success, partial, failed).

Re-evaluate a past run at any time:

```text
/history review <run_id>                    # walk every column again
/history review <run_id> --unevaluated-only # only columns you skipped
/history review <run_id> --apply            # short-circuit to writing on accept
```

This is where AMX differs from most "AI catalog" tools: nothing about the decision is
locked in. You can revisit, change your mind, and re-apply at any point.

## Skipping the review (`/run-apply`)

For pipelines where you already trust the model (e.g. dev / staging environments), `/run-apply`
runs the agents and writes back without opening the wizard. The orchestrator still
calibrates confidence and refuses to apply low-confidence suggestions by default — set
`--accept-all` to override (recommended only for sandbox runs).

Even with `/run-apply`, every column's full set of alternatives lands in `history.db`,
so a later `/history review --unevaluated-only` is still possible if you change your mind.

## Where the wizard lives

The review UI is implemented in `amx.cli_support.commands.run` with shared rendering helpers
in `amx.utils.live_display`. It is intentionally **not** part of the public Python API — for
headless reviews, the recommended pattern is to call `AMXApplication.infer_metadata`
programmatically, then drive your own UI with the returned `list[InferenceResult]`. See
[Python API](../api/index.md) for the contract.
