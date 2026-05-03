# Guide: keeping Snowflake warehouse cost bounded

Snowflake bills per warehouse-second. Run AMX naively against a wide schema and you can
wake up a warehouse for fifteen minutes per `/run`. This guide walks through the knobs
that keep cost predictable.

## Before you start

Decide three things up front:

1. **Which warehouse should AMX use?** A dedicated `AMX_WH` (XS or S) is ideal — its
   activity shows up in your warehouse usage reports under one name.
2. **What's an acceptable cost per run?** Pick a number ($1? $5? $20?). It anchors the
   profiling-mode decision.
3. **Are you optimising for first-pass or routine?** First-pass is one-off and worth more
   investment; routine is recurring and should be cheap.

## The cost levers

In rough order of impact (most → least):

1. **Profiling mode** — `metadata` ≪ `sampled` ≪ `full`.
2. **Schema scope** — one schema instead of the whole database, one table instead of the
   whole schema.
3. **`profiling_max_rows`** — the cutoff above which `full` mode falls back to lightweight
   metadata.
4. **`SAMPLE` size in `sampled` mode** — fewer rows sampled = cheaper.
5. **LLM cost** is separate but parallel — see [LLM Providers → cost controls](../llm-providers/index.md#cost-controls).

## Recommended profile

```yaml
db_profiles:
  snow_prod:
    backend: snowflake
    account: xy12345.eu-west-1
    user: AMX_SVC
    warehouse: AMX_WH       # dedicated XS warehouse
    role: AMX_ROLE
    database: ANALYTICS
    schema: PUBLIC
    private_key_path: ~/.snowflake/amx.p8

    profiling_mode: sampled
    profiling_max_rows: 1_000_000
    profiling_sample_size: 3
```

Why these defaults:

- **`AMX_WH` is XS.** Snowflake auto-suspends after 60s of inactivity (or whatever you
  configure). XS bills 1 credit/hour while running. If your runs are 5-minute bursts, you
  pay 5/60 of a credit per run. Compare: an L warehouse is 8x more expensive per second.
- **`sampled` mode** uses `SAMPLE` clauses; the warehouse reads a fraction of blocks
  instead of the full table.
- **`profiling_max_rows: 1_000_000`** is the cutoff above which AMX skips the expensive
  full-column scans even in `full` mode. Belt-and-suspenders.

## When to switch to `full`

`full` is right when:

- The table is small (tens of thousands of rows), and you really do want exact
  null/distinct/min/max stats.
- You're investigating a specific table and want the strongest signal — the cost of one
  expensive run is fine.
- The data is dynamic and a stale `sampled` profile would mislead the LLM.

```text
/db profiling full
/run sap_s6p.t001
/db profiling sampled       # switch back when done
```

## When to switch to `metadata`

`metadata` is right when:

- The schema has thousands of tables and you want an inventory pass first.
- You're in a dev environment with synthetic data where statistics aren't meaningful.
- The warehouse is asleep and you don't want to wake it.

```text
/db profiling metadata
/run sap_s6p
```

`metadata` mode does not run any data-scan SQL — Snowflake's metadata-only queries don't
require a running warehouse, so this can complete without waking `AMX_WH`. The Profile
Agent works from types, constraints, and existing comments alone.

## Watching the warehouse

```sql
-- Snowflake: the most expensive AMX queries last 24 hours
SELECT
    query_text,
    execution_time / 1000 AS seconds,
    bytes_scanned,
    credits_used_cloud_services
FROM snowflake.account_usage.query_history
WHERE warehouse_name = 'AMX_WH'
  AND start_time > DATEADD(hour, -24, CURRENT_TIMESTAMP())
ORDER BY execution_time DESC
LIMIT 20;
```

If you see queries scanning tens of GB, switch to `sampled`. If you see hundred-second
queries, the warehouse is too small for `full` mode against your tables — either size up
or switch modes.

## Combine with Batch for the LLM side

Switching profiling to `sampled` cuts warehouse cost. Switching the LLM to Batch cuts
LLM cost. Combined, a routine `/run sap_s6p --batch` against a wide schema can cost a few
dollars instead of a few tens of dollars.

```text
/use-llm openai_main_batch     # an LLM profile that uses gpt-4o-mini
/run sap_s6p --batch
```

OpenAI Batch returns logprobs so confidence calibration still works. See
[Batch mode](../llm-providers/batch-mode.md).

## Auto-suspend and auto-resume

If `AMX_WH` doesn't already auto-suspend, set it:

```sql
ALTER WAREHOUSE AMX_WH SET AUTO_SUSPEND = 60;       -- seconds
ALTER WAREHOUSE AMX_WH SET AUTO_RESUME = TRUE;
```

AMX doesn't manage warehouses — it just submits queries. If the warehouse is suspended,
Snowflake resumes it automatically; AMX waits.

## Cost monitoring loop

Every Friday:

```text
/usage 7d
```

Then in Snowflake:

```sql
-- Total credits used by AMX_WH in the last 7 days
SELECT SUM(credits_used) FROM snowflake.account_usage.warehouse_metering_history
WHERE warehouse_name = 'AMX_WH'
  AND start_time > DATEADD(day, -7, CURRENT_TIMESTAMP());
```

If the number is bigger than expected, change something — usually a switch to `sampled`
or `metadata` mode is enough.
