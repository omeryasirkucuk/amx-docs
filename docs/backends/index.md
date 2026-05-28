# Database backends

AMX ships adapters for **twelve database backends**. Every adapter normalises that backend's
introspection and comment APIs into the [Universal Metadata Interface](../concepts/universal-metadata.md)
so the agents and review wizard treat them identically. This page tells you which backend
to pick for which workload, the capability matrix across all twelve, and where each backend
diverges in profiling syntax or write-back SQL.

## Pick a backend

Use this short decision tree before you reach for any specific page:

- **Postgres-flavored OLTP / data warehouse with `COMMENT ON` semantics** → [PostgreSQL](postgresql.md). The reference adapter; everything else is normalised against it.
- **Cloud data warehouse with explicit warehouse cost / compute separation** → [Snowflake](snowflake.md), [Databricks](databricks.md), [BigQuery](bigquery.md), [Redshift](redshift.md). Pair with `profiling_mode: sampled` or `metadata` to keep the bill predictable.
- **Lakehouse via a query engine over open table formats (Iceberg / Delta / Hive)** → [Trino / Presto](trino.md). Covers the "I need one engine across S3 / GCS / on-prem HDFS" pattern and writes ANSI `COMMENT ON` straight through to the underlying connector.
- **HiveServer2 directly (local Docker / on-prem Hadoop / EMR / Cloudera CDH+CDP)** → [Hive](hive.md). Talks the Thrift protocol directly to the cluster; covers the legacy-warehouse case where Hive is the SQL engine, not just the metastore. Column-comment write-back stays disabled by design — see the page.
- **OLTP RDBMS at the edge of a data product** → [MySQL / MariaDB](mysql.md), [Oracle](oracle.md), [SQL Server](mssql.md). Use AMX to backfill descriptions on legacy systems.
- **Real-time analytics / event store** → [ClickHouse](clickhouse.md). Watch out for the shared-history-store caveat.
- **Embedded / file-based / Parquet+S3 documentation** → [DuckDB](duckdb.md). Excellent for prototyping AMX or documenting Parquet collections.

## Capability matrix

| Backend | Config (`backend`) | Install | Comment write-back | Shared history store |
|---|---|---|---|---|
| [PostgreSQL](postgresql.md) | `postgresql` | `pip install amx-cli` | `COMMENT ON …` | ✓ |
| [Snowflake](snowflake.md) | `snowflake` | `pip install amx-cli` | Snowflake `COMMENT` | ✓ |
| [Databricks](databricks.md) | `databricks` | `pip install amx-cli` | `COMMENT ON COLUMN` (Unity Catalog) | ✓ |
| [BigQuery](bigquery.md) | `bigquery` | `pip install amx-cli` | `ALTER … SET OPTIONS` | ✓ |
| [MySQL / MariaDB](mysql.md) | `mysql` | `pip install amx-cli` | `ALTER TABLE … COMMENT` | ✓ |
| [Oracle](oracle.md) | `oracle` | `pip install amx-cli` | `COMMENT ON COLUMN` | ✓ |
| [SQL Server](mssql.md) | `mssql` | `pip install amx-cli` (+ ODBC Driver 18) | `sp_addextendedproperty` | ✓ |
| [Redshift](redshift.md) | `redshift` | `pip install amx-cli` | `COMMENT ON …` | ✓ |
| [ClickHouse](clickhouse.md) | `clickhouse` | `pip install amx-cli` | `ALTER TABLE … MODIFY COMMENT` | ✗ (no row-level `UPDATE`) |
| [DuckDB](duckdb.md) | `duckdb` | `pip install amx-cli` | `COMMENT ON COLUMN` | ✗ (single-writer file) |
| [Trino / Presto](trino.md) | `trino` | `pip install 'amx-cli[trino]'` | `COMMENT ON TABLE / COLUMN / VIEW / SCHEMA` | ✗ (writeback is connector-dependent) |
| [Hive (HiveServer2)](hive.md) | `hive` | `pip install 'amx-cli[hive]'` | `ALTER TABLE / VIEW … SET TBLPROPERTIES` + `ALTER DATABASE … SET DBPROPERTIES` (no columns) | ✗ (row UPDATE is partition-/transactional-only) |

`pip install amx-cli` ships only the DuckDB driver in the base install. Every other
backend's driver is installed on first use (this needs network access). Trino and Hive
additionally live in optional `[trino]` / `[hive]` extras. The Hive extra uses `pure-sasl`
(pure Python) instead of the legacy `sasl` C extension so it wheels cleanly on macOS /
Linux / Windows.

!!! note "Air-gapped installs"
    Because non-DuckDB drivers are fetched on first use, a machine with no outbound
    network access must have the relevant driver(s) pre-installed (e.g. vendored into the
    environment ahead of time). Plan for this when running AMX in an isolated network.

## Distinctive object types per backend

Beyond tables and views, each adapter exposes the object types that are first-class on
its backend. These are listable via `/metadata` (and counted by `/inspect`); the
inference loop currently focuses on tables, views, and materialized views.

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
| Trino / Presto | materialized views, external tables, **catalogs** (3-level `catalog.schema.table` hierarchy across hive / iceberg / delta / tpch / memory connectors) |
| Hive (HiveServer2) | external tables, partitioned tables, **TBLPROPERTIES / DBPROPERTIES** key-value metadata (where Hive stores table-level and database-level comments) |

`BackendCapabilities` flags gate which list operations the connector even attempts, so
unsupported types short-circuit cleanly with a clear "not supported on this backend"
rather than a generic driver error.

## Profiling guardrails per backend

All backends honour the three [profiling modes](../configuration/profiling-modes.md) —
`full`, `sampled`, `metadata`. Backend-specific sampling syntax is used where supported:

- **PostgreSQL** — `TABLESAMPLE BERNOULLI` / `SYSTEM`.
- **Snowflake** — `SAMPLE` / `SAMPLE BLOCK`.
- **Databricks** — `TABLESAMPLE`.
- **BigQuery** — `TABLESAMPLE SYSTEM`.
- **MySQL / Oracle / SQL Server / Redshift** — backend statistics + small sample only when in `sampled` mode.
- **ClickHouse** — `SAMPLE` clause.
- **DuckDB** — `USING SAMPLE`.
- **Trino / Presto** — `TABLESAMPLE BERNOULLI` (default) or `SYSTEM`. With `profiling_approximate: true` the COUNT-DISTINCT path also switches to Trino's `approx_distinct` (HyperLogLog) so wide tables across hive / iceberg connectors stay cheap.
- **Hive (HiveServer2)** — `SUM(CASE WHEN col IS NULL THEN 1 ELSE 0 END)` + `COUNT(DISTINCT col)` profiling expressions (HiveQL has no ANSI `FILTER (WHERE …)` aggregate clause). Sampling defaults to a bounded `LIMIT :lim` rather than `TABLESAMPLE` because `TABLESAMPLE BUCKET` only works on bucketed tables and `TABLESAMPLE (n PERCENT)` triggers a full input read on most file formats.

When backend table-stats are unavailable in `full` mode (Snowflake, Databricks, BigQuery),
AMX skips the expensive full column scans and falls back to lightweight metadata + samples
rather than running an unbounded query.

## Connection setup walkthroughs

Each backend page follows the same template: prerequisites → `/add-db-profile` walkthrough
with verbatim wizard prompts → sample `~/.amx/config.yml` block → verify steps →
troubleshooting table → what to read next.

- [PostgreSQL](postgresql.md) — the reference adapter.
- [Snowflake](snowflake.md) — warehouse / role selection, key-pair / SSO auth.
- [Databricks](databricks.md) — Unity Catalog, corporate-TLS recovery.
- [BigQuery](bigquery.md) — ADC vs service-account JSON, profiling-mode selection.
- [MySQL / MariaDB](mysql.md) — privilege grants, charset notes.
- [Oracle](oracle.md) — service name vs SID, thin-mode default.
- [SQL Server](mssql.md) — ODBC Driver 18 install per OS, Azure SQL specifics.
- [Redshift](redshift.md) — Provisioned / Serverless, password / IAM auth.
- [ClickHouse](clickhouse.md) — HTTP vs HTTPS port choice, history-store caveat.
- [DuckDB](duckdb.md) — file vs `:memory:`, attached scanner workflows.
- [Trino / Presto](trino.md) — coordinator host, Basic vs JWT auth, catalog picker for lakehouse deployments.
- [Hive (HiveServer2)](hive.md) — HS2 host, PLAIN / LDAP / NOSASL auth picker, four deployment-pattern recipes (local Docker, on-prem Hadoop, EMR, Cloudera CDP).
