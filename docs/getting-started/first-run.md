# First run walkthrough

This page narrates a complete AMX session against a small Postgres database, from a fresh
install to comments persisted on the live tables. Substitute your own backend and credentials
where appropriate — the flow is identical.

## Setup

The example uses an SAP-style schema (`sap_s6p`) with two tables: `t001` (company codes)
and `vbak` (sales document headers). Both ship without column comments.

```bash
pip install amx-cli
amx
```

Inside the REPL:

```text
/setup
```

The wizard creates one DB profile (`local_pg`) and one LLM profile (`openai_main`). It also
prompts for an optional document profile and codebase profile — for this walkthrough we
configure both:

- **Documents profile** (`sap_handbook`): a folder of PDF technical manuals at
  `~/work/sap-docs`. AMX will ingest these into the RAG store.
- **Codebase profile** (`etl_repo`): the path to an internal ETL repo with SQL + Python
  references to the same tables. AMX will scan and semantically index this.

After setup completes:

```text
/config
```

shows the active profiles and confirms guardrails (`profiling_mode: full`, `language: en`,
`prompt_detail: standard`).

## Ingest documents

```text
/docs
/index
```

`/index` scans the active doc profile, splits each file into chunks, embeds them, and
upserts into the local Chroma vector store.

Check that the docs are searchable before running the agents:

```text
/search-docs primary key for company code
```

returns the top doc snippets. If this is empty, `/index` will tell you what AMX
discovered (or didn't) on the configured paths.

## Index the codebase

```text
/code
/code-index
```

The first index walks the entire repo, extracts function/class spans for Python and text
chunks for other languages, and builds the `amx_code` Chroma collection. Cached results
land in `~/.amx/code_cache/etl_repo/`. Subsequent runs read the cache; run `/code-index`
again to refresh after the tree changes.

```text
/code-results
```

shows what was indexed.

## Run the agents

Pick a single table for the first run so the wall clock stays short:

```text
/run sap_s6p.t001
```

You'll see live progress: which agent is active, which column is being processed, token
usage so far, and elapsed time. The output is something like:

```text
✓ Profile Agent       17 columns scored
✓ RAG Agent           14/17 columns enriched (3 had no doc evidence)
✓ Code Agent          11/17 columns enriched (6 not found in code)
✓ Orchestrator        merged 17 column suggestions, 1 table summary
```

## Review

`/run` first asks you to choose a review strategy: one-by-one, accept-all-high, accept-all,
or reject-all. Reviewing one-by-one, AMX shows each column with a numbered picker:

```text
sap_s6p.t001.audat — column 7 of 17

  1. Document date. Calendar date the source business event was recorded;
     distinct from posting date (BUDAT) which controls the accounting period.
     confidence: high · logprob: 0.91 · sources: code (3 refs), docs, profile
  2. Audit date. Timestamp of the most recent audit run on this row.
     confidence: low · logprob: 0.42 · sources: profile only
  3. Document creation date. Same as ERFDAT in adjacent SAP tables.
     confidence: medium · logprob: 0.66 · sources: docs

  Type a number to pick a description, "s" to skip, or "o" for your own text.
```

Type the number of the description you want, `s` to skip the column, or `o` to write your
own text. AMX moves to the next column.

To accept the high-confidence suggestions in bulk without stepping through each column,
choose the **accept-all-high** strategy when `/run` prompts for it.

## Apply to the database

When the review is complete:

```text
/apply
```

AMX writes back via the backend's native comment mechanism — `COMMENT ON COLUMN` for
PostgreSQL, `ALTER … MODIFY COMMENT` for ClickHouse, `sp_addextendedproperty` for SQL
Server, and so on. Verify with `psql`:

```sql
SELECT column_name, col_description('sap_s6p.t001'::regclass, ordinal_position)
FROM information_schema.columns
WHERE table_schema = 'sap_s6p' AND table_name = 't001';
```

The descriptions you accepted are now part of the database.

## Inspect history

Every run is recorded:

```text
/history list -n 5
/history show <run_id>
/history results <run_id>
```

`/history results` shows every alternative AMX generated for the run, even the ones you
didn't pick — useful for second-guessing a decision later. To re-evaluate a past run:

```text
/history review <run_id> --unevaluated-only
```

## What to do next

- **Run against a whole schema**: `/run sap_s6p` — same flow, more columns.
- **Use `/ask` to interrogate the catalog**: `/ask which tables in sap_s6p store dates?`
  See [Ask & Search](../cli/ask-and-search.md).
- **Reduce warehouse load**: switch profiling to `sampled` for very large warehouses — see
  [Profiling modes](../configuration/profiling-modes.md).
- **Share with your team**: enable the [shared history store](../collaboration/shared-history-store.md)
  so teammates can see your runs.
