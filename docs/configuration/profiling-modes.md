# Profiling modes

Each DB profile has a profiling mode that controls how aggressively AMX reads table data
when profiling. The mode is the single biggest knob for warehouse load — choose it before
tuning prompts.

## The three modes

| Mode | Row count | Per-column stats | Sample values | Warehouse load |
|---|---|---|---|---|
| `full` | exact `COUNT(*)` | null / distinct / min / max via aggregate scan | up to 5 distinct non-null per column | high |
| `sampled` | backend table statistics | small backend-sample only | small sample via backend sampling syntax | low |
| `metadata` | backend table statistics only | none | none | minimal |

### `full`

```text
/db profiling full
```

Exact row count plus per-column null count, distinct count, min/max, and samples. If table
statistics report more rows than `profiling_max_rows`, AMX **skips the expensive full
column scans** and keeps lightweight metadata plus samples — so a wildly oversized table
can't accidentally start a sequential scan.

Snowflake, Databricks, and BigQuery also skip full scans when row-count statistics are
unavailable rather than running an unbounded query.

Use `full` for:

- Small to medium tables (< 5M rows by default).
- Initial inference where you want every signal possible.
- Tables that don't have reliable backend statistics.

### `sampled`

```text
/db profiling sampled 500000 3
```

Skips exact row count and full per-column aggregate scans; uses backend table statistics
when available and retrieves only small sample values with backend sampling syntax where
supported.

Use `sampled` for:

- Production warehouses where `full` would be expensive.
- Routine re-runs after metadata is already in good shape.
- Wide schemas where the per-column distinct counts aren't load-bearing.

### `metadata`

```text
/db profiling metadata
```

Skips table-data reads entirely. Uses schema metadata, comments, constraints, and backend
table statistics when available.

Use `metadata` for:

- Initial discovery on huge warehouses where you want "what tables exist?" before doing
  any column profiling.
- CI / dev environments where the data is synthetic and column statistics aren't
  meaningful.
- Demos against backends where you want to avoid touching table data.

## Setting the mode

```text
/db
/profiling                                    # show active settings
/profiling full                               # mode only
/profiling sampled 500000 3                   # mode + max_rows + sample_size
/profiling metadata
/profiling full off 5                         # full mode, no max-row cutoff, samples=5
```

`off` for `max_rows` removes the cutoff entirely. Settings are saved on the active DB
profile in `config.yml`.

## Backend sampling syntax

When `sampled` mode applies, AMX uses each backend's native sampling clause:

| Backend | Sampling SQL |
|---|---|
| PostgreSQL | `TABLESAMPLE BERNOULLI (n)` / `TABLESAMPLE SYSTEM (n)` |
| Snowflake | `SAMPLE (n PERCENT)` / `SAMPLE BLOCK (n PERCENT)` |
| Databricks | `TABLESAMPLE (n PERCENT)` |
| BigQuery | `TABLESAMPLE SYSTEM (n PERCENT)` |
| MySQL / Oracle / SQL Server / Redshift | Backend statistics + small sample only |
| ClickHouse | `SAMPLE (n)` (only on tables with a sampling key) |
| DuckDB | `USING SAMPLE n PERCENT` |

When the backend doesn't support sampling, AMX falls back to a `LIMIT` plus optional
`ORDER BY RANDOM()` so the sample isn't biased toward physical row order.

## Backend behavior

Wall-clock impact varies per backend:

- **PostgreSQL / MySQL / Oracle / MSSQL / DuckDB.** Self-hosted; impact is wall-clock and
  storage I/O. `full` on a wide 50M-row table can take minutes; `sampled` runs in seconds.
- **Snowflake.** `full` against a wide table can wake the warehouse and run for tens of
  seconds. Switch to `sampled` or `metadata` for routine work.
- **Databricks.** Same as Snowflake — `full` runs against the SQL warehouse for the
  duration of the scan.
- **BigQuery.** `full` runs `COUNT(*)` and per-column distinct counts; on a partitioned
  table this is bounded but on a non-partitioned 1TB table it's the full table. Use
  `sampled` or `metadata` for regular work.
- **Redshift.** `full` mode can lock the warehouse for other workloads — wall-clock
  matters here even on idle clusters.
- **ClickHouse.** `full` against a `MergeTree` table is fast but reads bytes from disk;
  `sampled` is much faster on large tables.

## Failure handling

Backend profiling failures are normalised into actionable messages where possible.
PostgreSQL, Snowflake, Databricks, and BigQuery permission / missing-object / warehouse /
quota / connection failures surface remediation text instead of leaking raw driver
tracebacks. AMX can skip expensive per-column stats when a single column-level stats query
fails, so the run keeps making progress.

## What gets sent to the LLM

Independent of profiling mode, AMX never sends full table dumps. The Profile Agent
prompt includes:

- Table-level: row count (when available), existing comments, schema/database comment.
- Per-column: name, type, nullable, null count, distinct count, cardinality ratio, min/max,
  up to 5 sample values, existing comment.
- Constraints: PK, FKs in/out, unique, check.
- Related metadata: existing comments on FK-related neighbour tables.

In `metadata` mode, the per-column null/distinct/min/max fields are omitted entirely (they
weren't computed). The LLM works from the type and existing comment alone.

## Recommendations

| Scenario | Mode |
|---|---|
| Local dev DB | `full` |
| Production warehouse first run | `sampled` |
| Production warehouse recurring | `sampled` or `metadata` |
| BigQuery against TB-scale tables | `metadata` for discovery, `sampled` for inference |
| Snowflake when the warehouse is asleep | `metadata` (avoids waking it) |
| Anything where you want the strongest signal | `full` |

Use `/usage 7d` after a few runs to see token consumption and adjust accordingly.
