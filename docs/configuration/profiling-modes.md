# Profiling modes

Each DB profile has a profiling mode that controls how aggressively AMX reads table
data before sending it to the LLM. The mode is the single biggest knob for warehouse
cost, run latency, and description quality. This page explains the three modes, when
to pick each one, the per-backend behavior, and the cost / time trade-offs with real
numbers.

## Prerequisites

- AMX installed.
- An active DB profile.

## The three modes

| Mode | Reads | Cost on warehouse backends | When to use |
|---|---|---|---|
| `full` | Every row in the table | High (full scan) | You need exact distinct counts for keys / cardinality validation |
| `sampled` | TABLESAMPLE / SAMPLE / USING SAMPLE — typically 5,000 rows | Low (small scan) | Daily description drafting; the recommended default |
| `metadata` | INFORMATION_SCHEMA / system catalogs only | Zero (no rows scanned) | Whole-warehouse inventory sweeps; cheap whole-schema first drafts |

## Step-by-step

### 1. Set the mode per profile

In `~/.amx/config.yml`:

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    # ...
    profiling_mode: sampled        # full | sampled | metadata
    profiling_sample_size: 5000    # only used in `sampled` mode
    profiling_max_rows: 1000000    # safety cap even in `full` mode
```

Or interactively:

```text
> /db profiling-mode
Current mode: full
  full      — read every row to compute exact null/distinct stats
  sampled   — TABLESAMPLE BERNOULLI(N) — fast, cheap, good enough for description drafting
  metadata  — only read SHOW / INFORMATION_SCHEMA — no row scans at all

> /db profiling-mode sampled
✓ Active mode → sampled (5000 rows per table)
```

### 2. Override per command

Every mode-aware command (`/run`, `/profile`, `/sync`) accepts `--profiling-mode`:

```text
> /run sales --profiling-mode metadata --auto-accept-high
[scope]   18 tables (sales)
[Profile] reading INFORMATION_SCHEMA for 18 tables ...  ok (0.4 s)
[LLM]     drafting 412 column descriptions in 21 batches ...  ok in 38 s
✓ /run finished. 412 columns drafted (no row scans on the warehouse).
```

This is the cheapest possible whole-warehouse sweep — no rows scanned.

### 3. Verify what each mode actually queries

```text
> /run sales.customer --profiling-mode full --debug | grep "SQL"
[SQL Profile] SELECT * FROM sales.customer
[SQL Profile] SELECT COUNT(DISTINCT c_first_name), COUNT(DISTINCT c_last_name), ...

> /run sales.customer --profiling-mode sampled --debug | grep "SQL"
[SQL Profile] SELECT * FROM sales.customer TABLESAMPLE BERNOULLI(5000) LIMIT 5000

> /run sales.customer --profiling-mode metadata --debug | grep "SQL"
[SQL Profile] SELECT column_name, data_type, is_nullable FROM information_schema.columns
              WHERE table_schema = 'sales' AND table_name = 'customer';
```

## Per-backend sampling syntax

The `sampled` mode uses backend-native sampling where supported:

| Backend | Sampling SQL |
|---|---|
| PostgreSQL | `TABLESAMPLE BERNOULLI(<n>)` (or `SYSTEM` for fast-but-clumpy) |
| Snowflake | `SAMPLE (<n> ROWS)` (or `SAMPLE BLOCK (<n>)` for column-store-friendly) |
| Databricks | `TABLESAMPLE (<n> ROWS)` |
| BigQuery | `TABLESAMPLE SYSTEM (<percent> PERCENT)` (BQ has no row-count form) |
| Redshift | falls back to backend stats + small `LIMIT` |
| MySQL / MariaDB | falls back to backend stats + small `LIMIT` |
| Oracle | `SAMPLE (<percent>)` clause + small `LIMIT` |
| SQL Server | `TABLESAMPLE (<n> ROWS)` |
| ClickHouse | `SAMPLE <n>` clause |
| DuckDB | `USING SAMPLE <n> ROWS` |

When backend table-stats are unavailable in `full` mode (rare but possible on
Snowflake / Databricks / BigQuery), AMX falls back to the `sampled` path automatically
and prints a warning rather than running an unbounded query.

## Cost / time examples

Approximate numbers for a typical 47-table / 1,283-column schema:

| Backend × Mode | Wall time | Compute cost |
|---|---|---|
| PostgreSQL × `metadata` | ~5 s | ~$0 |
| PostgreSQL × `sampled` | ~30 s | ~$0 |
| PostgreSQL × `full` | minutes (depends on row count) | ~$0 |
| Snowflake X-Small × `metadata` | ~10 s | ~$0 (no warehouse wake) |
| Snowflake X-Small × `sampled` | ~45 s | ~1–3 credit-seconds (~$0.01–$0.03) |
| Snowflake X-Small × `full` | minutes–hours | depends on table sizes |
| BigQuery × `metadata` | ~8 s | $0 (INFORMATION_SCHEMA is free) |
| BigQuery × `sampled` | ~25 s | a few MB × per-table = pennies |
| BigQuery × `full` | depends on scan size | scan-size × $5/TB |
| Databricks Serverless × `sampled` | ~60 s (incl. cold start) | depends on warehouse size |

These numbers are illustrative — your row counts, table widths, and warehouse size
matter. Always run `/profile <one-table>` first and check the timer before unleashing
`/run` on a whole schema.

## Decision flow

- **Whole-warehouse first sweep** → `metadata` for inventory, then `sampled` only on the subset you want descriptions for.
- **Daily description drafting** → `sampled`. The default for a reason.
- **Cardinality / uniqueness audit** → `full` on the specific table only. Don't run `full` warehouse-wide.
- **Snowflake / Databricks / BigQuery on a tight budget** → `metadata` for the bulk, with `sampled` reserved for tables you actually care about.
- **DuckDB / local Postgres** → `full` is fine; warehouse cost concerns don't apply.

## Sample config

```yaml
db_profiles:
  prod-sf:
    backend: snowflake
    # ...
    profiling_mode: sampled
    profiling_sample_size: 5000
    profiling_max_rows: 1000000
```

`profiling_max_rows` is a safety cap — it applies even in `full` mode, so a `/run` on
an unexpectedly huge table can't accidentally bill you for an hour-long warehouse scan.

## Verify

1. `> /db profiling-mode` — prints the current mode.
2. `> /run --profiling-mode metadata --filter '^stg_'` — a metadata-only sweep over staging tables; should complete in a few seconds and cost nothing.
3. `> /history show <run-id>` after a run — shows wall-clock time and (on warehouse backends) approximate scanned bytes.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Profile agent fell back to sampled mode (table-stats unavailable)` warning during `full` run | Backend hasn't computed stats for the table (e.g. brand-new Snowflake table) | Run `ANALYZE TABLE …` (or backend equivalent), or accept the sampled fallback |
| Costs higher than expected on Snowflake | `full` mode wakes the warehouse for the duration of every column-stats query | Switch to `sampled`; or set the warehouse to a smaller size |
| All sampled output looks identical for a clustered column | Table is range-partitioned and the sample landed in one partition | Increase `profiling_sample_size`, or use `TABLESAMPLE SYSTEM` for block sampling |
| `metadata` mode skipped a column | The column was added after the catalog stats were last refreshed | `> /sync` to refresh; or run `ANALYZE` on the table |
| `profiling_max_rows` keeps tripping | Cap is set too low for tables you actually need full stats on | Raise the per-profile cap, or override per-run with `--profiling-max-rows` |

## What's next

- [Configuration: env vars](env-vars.md) — global overrides for sampling.
- [Run & Apply](../cli/run-and-apply.md) — `/run` flag combinations including profiling overrides.
- [Per-backend pages](../backends/index.md) — backend-specific notes on what `full` actually costs.
