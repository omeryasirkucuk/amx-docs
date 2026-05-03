# `/run`, `/run-apply`, `/apply`

The metadata generation pipeline. `/run` opens an interactive review; `/run-apply` skips it
and writes back immediately; `/apply` writes whatever you've already accepted in the current
session.

## `/run`

```text
/run                      # opens scope picker (Database / Schema / Asset)
/run sap_s6p              # whole schema
/run sap_s6p.t001         # one table
/run t001 vbak            # multiple tables in the active schema
/run --code-profile etl_repo --doc-profile sap_handbook
```

Flags:

- `--db-profile NAME` — use a non-active DB profile for this run.
- `--llm-profile NAME` — same, for the LLM.
- `--code-profile NAME` — same, for the codebase.
- `--doc-profile NAME` — same, for documents.
- `--code-refresh` — invalidate the code-scan cache before running.
- `--apply` — short-circuit to writing on accept (equivalent to `/run-apply`).

### What happens

1. **Pre-flight.** AMX verifies the active LLM is reachable. A dead key fails fast,
   before any DB profiling work.
2. **Profile.** The Profile Agent batches columns and asks the LLM for descriptions
   grounded in DB stats and samples.
3. **RAG.** The RAG Agent retrieves relevant document snippets per column and asks the LLM
   to draft suggestions.
4. **Code.** The Code Agent retrieves nearest-neighbour code chunks and literal references,
   then asks the LLM.
5. **Merge.** The orchestrator merges per-column candidates, calibrates confidence using
   logprobs, and produces a final ranked list.
6. **Review.** The interactive wizard opens — see [Human in the loop](../concepts/human-in-the-loop.md).

The Profile Agent always runs. The RAG and Code agents run only when their respective
profiles are configured and have evidence to work with.

### Live progress

`/run` shows a live terminal panel: which agent is active, which column is being processed,
elapsed time, and tokens used. Press `Ctrl+C` once to gracefully cancel after the current
LLM call returns; press it twice to abort immediately.

## `/run-apply`

```text
/run-apply sap_s6p.t001
```

Same as `/run --apply`. Skips the interactive review and writes accepted suggestions back
to the database. The orchestrator still calibrates confidence and refuses to apply
low-confidence suggestions by default.

`/run-apply` is most useful in scripts and CI. For interactive use, `/run` followed by
`/apply` is safer.

## `/apply`

```text
/apply
```

Writes any descriptions you accepted during the current session's `/run` to the database.
`/apply` is a no-op if there's nothing pending.

## What gets written

Per backend:

| Backend | Write SQL |
|---|---|
| PostgreSQL | `COMMENT ON COLUMN sch.tbl.col IS '…'` |
| Snowflake | `ALTER COLUMN … COMMENT '…'` (or `COMMENT ON COLUMN`) |
| Databricks | `ALTER TABLE … ALTER COLUMN … COMMENT '…'` (Unity Catalog SQL warehouse) |
| BigQuery | `ALTER TABLE … ALTER COLUMN … SET OPTIONS(description='…')` |
| MySQL | `ALTER TABLE … MODIFY COLUMN … COMMENT '…'` |
| Oracle | `COMMENT ON COLUMN … IS '…'` |
| SQL Server | `sp_addextendedproperty` / `sp_updateextendedproperty 'MS_Description'` |
| Redshift | `COMMENT ON COLUMN sch.tbl.col IS '…'` |
| ClickHouse | `ALTER TABLE … MODIFY COMMENT` (per column, 21.x+) |
| DuckDB | `COMMENT ON COLUMN sch.tbl.col IS '…'` |

Each adapter advertises capability flags. Unsupported writes (e.g. MySQL `COMMENT ON
SCHEMA`) raise rather than silently no-op so the apply count stays honest.

## `/code` and `/docs` standalone

You can also run the Code and RAG agents standalone — useful when you only want one
evidence source, or want to test prompts without paying for the full pipeline:

```text
/code-analyze sap_s6p.t001
/doc-analyze sap_s6p.t001
```

Both write their suggestions into the same staging area as `/run`, so a follow-up `/run`
will pick them up rather than re-querying the LLM. Combine with `/code-refresh` to force a
fresh scan first.

## Examples

Run against one schema with a custom LLM profile:

```text
/run sap_s6p --llm-profile gemini_pro
```

Run with code-refresh because the ETL repo changed:

```text
/run-apply sap_s6p.t001 --code-refresh
```

Bulk-accept high-confidence rows for a wide schema, leaving the rest for manual review:

```text
/llm-thresholds 0.9 0.6     # tighten the high band
/run sap_s6p
# inside the wizard, press "B" to bulk-accept above the high threshold
```

## Tuning for large schemas

For very large schemas, see:

- [Profiling modes](../configuration/profiling-modes.md) — switch to `sampled` or `metadata`
  to skip per-column data scans.
- [Batch mode](../llm-providers/batch-mode.md) — OpenAI / Anthropic Batch APIs for
  asynchronous overnight runs.
- `/llm-batch-size N` — more columns per LLM call = fewer round trips.
- `/n-alternatives 1` — single suggestion per column, no alternatives.
- `/prompt-detail minimal` — smallest prompt budget preset.
