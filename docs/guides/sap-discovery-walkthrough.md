# Guide: SAP discovery walkthrough

A worked example: bring a documentation-free SAP-style schema from cryptic identifiers to
fully-described columns in one afternoon. The same pattern applies to any
legacy / vendor-supplied schema with thousands of named-but-undocumented columns.

## The starting state

A read-only Postgres replica of an SAP S/6 source system, ~600 tables, 40K columns. Almost
no `COMMENT ON COLUMN`; all identifiers are SAP's German-rooted abbreviations
(`AUDAT`, `BUDAT`, `MATNR`, `MENGE`, …).

We have:

- **Documentation:** the SAP module manuals as PDFs, ~3,000 pages total. Mostly accurate
  but written for SAP consultants, not data engineers.
- **Codebase:** the company's ETL repo (Python + SQL) which loads selected SAP tables into
  a downstream warehouse. References are concentrated in transform scripts.
- **Time budget:** one afternoon for the high-confidence majority; the rest can wait.

## Setup

```bash
pip install amx-cli
amx
/setup
```

Three profiles:

- **DB:** `sap_replica` — Postgres with `profiling_mode: sampled` and
  `profiling_max_rows: 5_000_000`. The replica has billions of rows; we don't want
  `full` mode here.
- **LLM:** `openai_main` — `gpt-4o` with `language: en`, `temperature: 0.2`,
  `n_alternatives: 3`.
- **Doc:** `sap_handbook` — local path to the PDFs.
- **Code:** `etl_repo` — the company's ETL repo on disk.

## Ingest documents and scan the codebase

```text
/docs
/index --refresh
/code
/code-index
```

Total time: ~12 minutes for the PDFs (embedding via MiniLM) and ~4 minutes for the ETL
repo. Sanity check:

```text
/search-docs document date posting date
```

Returns relevant SAP doc snippets — the RAG store is healthy.

## Plan the run

The schema is huge. We won't try to do everything at once. Instead:

1. **First pass (this afternoon):** the 50 tables that ETL actually touches. The Code
   Agent will have strong evidence for these, so the multi-agent merge will have
   high-confidence output.
2. **Second pass (later this week):** the next 200 tables. Doc evidence dominates,
   confidence will be lower, more manual review.
3. **Third pass (next month):** the long tail. Bulk `metadata` mode for inventory, then
   prioritise from `/ask`.

## First pass — the 50 ETL-touched tables

```text
/run sap_s6p t001 mara makt mvke mara_text vbak vbap likp lips bkpf bseg
```

(plus the rest of the 50, listed)

Wall clock: ~25 minutes.

`/run` generates the descriptions and then walks the review: for each
column you get a numbered list of candidate descriptions — type the
number to pick one, `s` to skip, or `o` to write your own text. (When
prompted at the start of the run you can choose the strategy:
one-by-one, accept-all-high, accept-all, or reject-all.)

- ~70% of columns: top suggestion is `high` confidence with all three agents agreeing.
  Accept the top pick (or run with accept-all-high so they go through automatically).
- ~20%: `medium` with one or two agents agreeing. Read each one, pick the number you want.
- ~10%: `low` or split alternatives. Skip (`s`) for now or write your own (`o`).

Apply:

```text
/apply
```

Verify with `psql`:

```sql
SELECT column_name, col_description('sap_s6p.t001'::regclass, ordinal_position)
FROM information_schema.columns
WHERE table_schema = 'sap_s6p' AND table_name = 't001'
LIMIT 10;
```

## Use `/ask` to plan the second pass

```text
/ask which tables in sap_s6p contain customer data?
/ask which tables reference t001?
/ask top 20 tables by row count in sap_s6p
```

The Search Agent uses the catalog (now richer thanks to the first pass) to answer. The
top-20 inventory query gives us the next batch — high-volume tables that probably matter
most for downstream consumers.

## Second pass — wider scope, lighter model

We're confident in the prompts and the merge now. Switch to a smaller model for volume:

```text
/use-llm openai_mini       # gpt-4o-mini profile
/llm-batch-size 30
/n-alternatives 1
/run sap_s6p --batch       # async overnight via OpenAI Batch
```

Batch jobs run overnight. Next morning:

```text
/history list -n 5         # see the batch job complete
/history results <id>      # inspect alternatives before reviewing
```

Then walk the review wizard.

## Third pass — the long tail

For the remaining ~350 tables, switch to `metadata` mode:

```text
/profiling metadata
/run sap_s6p --batch
```

The Profile Agent now sees only schema metadata (types, constraints, comments on
neighbours) — no per-column scans. Confidence will be lower, so accept rate during
review is lower too. The output is good enough for inventory; targeted high-confidence
runs against specific tables can come later.

## Three weeks in

```text
/usage 30d
```

Reports total token consumption.

```text
/history compare --schema sap_s6p --by llm_model --last 5 --diff
```

Pivots the most recent five sap_s6p runs side by side, grouped by model. Shows where the
smaller model produced different (sometimes better, sometimes worse) descriptions.

## Lessons learned (for next time)

- **Code coverage matters more than doc coverage.** The 70% high-confidence rate on the
  ETL-touched tables drops to ~40% on tables ETL doesn't touch. If the team can extend
  ETL coverage (even just SELECT statements that reference the tables), AMX inference
  improves directly.
- **Bulk-accept saves the most time, but only after you've calibrated.** First pass:
  manual per-column. Second pass: aggressive bulk-accept once you trust the high-confidence
  band.
- **Switch to Batch as soon as you can.** Synchronous chat is for the first pass; once
  prompts are stable, every subsequent run should go through Batch.
