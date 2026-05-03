# Database backends

AMX ships adapters for ten database backends. Each adapter normalises the backend's
introspection and comment APIs into the [Universal Metadata Interface](../concepts/universal-metadata.md)
so the agents and review wizard treat them identically.

## Capability matrix

| Backend | Config (`backend`) | Install | Comment write-back | Shared history store |
|---|---|---|---|---|
| [PostgreSQL](postgresql.md) | `postgresql` | `pip install amx` | `COMMENT ON …` | ✓ |
| [Snowflake](snowflake.md) | `snowflake` | `pip install amx` | Snowflake `COMMENT` | ✓ |
| [Databricks](databricks.md) | `databricks` | `pip install amx` | `COMMENT ON COLUMN` (Unity Catalog) | ✓ |
| [BigQuery](bigquery.md) | `bigquery` | `pip install amx` | `ALTER … SET OPTIONS` | ✓ |
| [MySQL / MariaDB](mysql.md) | `mysql` | `pip install amx` | `ALTER TABLE … COMMENT` | ✓ |
| [Oracle](oracle.md) | `oracle` | `pip install amx` | `COMMENT ON COLUMN` | ✓ |
| [SQL Server](mssql.md) | `mssql` | `pip install amx` (+ ODBC Driver 18) | `sp_addextendedproperty` | ✓ |
| [Redshift](redshift.md) | `redshift` | `pip install amx` | `COMMENT ON …` | ✓ |
| [ClickHouse](clickhouse.md) | `clickhouse` | `pip install amx` | `ALTER TABLE … MODIFY COMMENT` | ✗ (no `UPDATE`) |
| [DuckDB](duckdb.md) | `duckdb` | `pip install amx` | `COMMENT ON COLUMN` | ✗ (local file) |

`pip install amx` pulls in every driver. For most teams, picking just the engines you
actually use keeps the install lean.

## Distinctive object types per backend

Beyond tables and views, each adapter exposes the object types that are first-class on its
backend. These are listable via `/metadata` (and counted by `/db inspect`); the inference
loop currently focuses on tables, views, and materialized views.

| Backend | Distinctive types |
|---|---|
| PostgreSQL | procedures, functions, sequences, triggers, UDTs |
| Snowflake | procedures, functions, sequences, **tasks**, **stages**, **shares**, external tables |
| Databricks | user functions, **volumes**, external tables |
| BigQuery | routines (procedures + functions), external tables |
| MySQL / MariaDB | procedures, functions, triggers, **events** (scheduled jobs), partition strategy, storage engine |
| Oracle | materialized views, procedures, functions, **packages**, triggers, sequences, synonyms, UDTs |
| SQL Server | procedures, functions (FN/TF/IF), triggers, sequences, synonyms, partitions |
| Redshift | materialized views, procedures, UDFs, **datashares**, **external tables** (Spectrum), `diststyle` / `sortkey` / encoding |
| ClickHouse | materialized views, UDFs, **dictionaries**, skipping indices, MergeTree engine info |
| DuckDB | sequences, functions, **macros**, attached databases (Parquet/S3/Postgres scanner) |

`BackendCapabilities` flags gate which list operations the connector even attempts, so
unsupported types short-circuit cleanly with a clear "not supported on this backend" rather
than a generic driver error.

## Profiling guardrails per backend

All backends honour the three [profiling modes](../configuration/profiling-modes.md) —
`full`, `sampled`, `metadata`. Backend-specific sampling syntax is used where supported:

- **PostgreSQL** — `TABLESAMPLE BERNOULLI` / `SYSTEM`.
- **Snowflake** — `SAMPLE` / `SAMPLE BLOCK`.
- **Databricks** — `TABLESAMPLE`.
- **BigQuery** — `TABLESAMPLE SYSTEM`.
- **MySQL / Oracle / SQL Server / Redshift** — backend statistics + small sample only when
  in `sampled` mode.
- **ClickHouse** — `SAMPLE` clause.
- **DuckDB** — `USING SAMPLE`.

When backend table-stats are unavailable in `full` mode (Snowflake, Databricks, BigQuery),
AMX skips the expensive full column scans and falls back to lightweight metadata + samples
rather than running an unbounded query.

## Connection setup

Pick your backend below for connection fields, auth options, and gotchas:

- [PostgreSQL](postgresql.md)
- [Snowflake](snowflake.md)
- [Databricks](databricks.md)
- [BigQuery](bigquery.md)
- [MySQL](mysql.md)
- [Oracle](oracle.md)
- [SQL Server](mssql.md)
- [Redshift](redshift.md)
- [ClickHouse](clickhouse.md)
- [DuckDB](duckdb.md)

Each page follows the same structure: install extras, connection fields, sample
`config.yml` block, capability notes, and known limitations.
