# DuckDB

DuckDB is supported as a single-file analytics engine and as `:memory:` for ephemeral use.
It's the easiest backend to try AMX against — no server to set up, no credentials.

## Install

```bash
pip install "amx[duckdb]"
```

Drivers: `duckdb`, `duckdb-engine`.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `database` | yes | Path to a `.duckdb` file (`/data/warehouse.duckdb`) or `:memory:` |
| `read_only` | no | `true` to open in read-only mode (recommended for AMX) |

There are no other fields — DuckDB is local.

## Sample `config.yml`

```yaml
db_profiles:
  local_duck:
    backend: duckdb
    database: ~/data/warehouse.duckdb
    read_only: true
    profiling_mode: full
```

## Capabilities

- Comment write-back via `COMMENT ON COLUMN`. **Schema-level comments are unsupported**
  in DuckDB 1.x — AMX surfaces this as a clear error.
- Distinctive object types listable via `/metadata`: sequences, functions, **macros**
  (DuckDB's parameterised SQL primitive), attached databases (Parquet / S3 / Postgres
  scanner).
- `USING SAMPLE` used in `sampled` profiling mode.

## Attached databases

DuckDB can attach external sources as logical schemas — Parquet files, an S3 bucket, a
remote Postgres. AMX surfaces these via the attached-databases listing under
`/metadata`. Each attached source appears as a schema-equivalent.

```sql
ATTACH 's3://my-bucket/warehouse/' AS s3_warehouse;
ATTACH 'host=pg.example.com user=… dbname=…' AS pg_remote (TYPE postgres);
```

After attaching, run `/db sync` so the catalog picks up the new schemas, then `/run` as
usual. The Profile Agent treats attached schemas identically to native ones.

## Required permissions

DuckDB has no users — file-level filesystem permissions decide access. AMX defaults to
`read_only: true` so a corrupt write can't damage the file.

## Known limitations

- **DuckDB is blocked from shared mode.** DuckDB is a local file, not shared storage. The
  Enable wizard for the [shared history store](../collaboration/shared-history-store.md)
  refuses DuckDB with a clear error.
- **Schema comments are unsupported in DuckDB 1.x.** Database and column comments work.
- DuckDB extensions (`httpfs`, `aws`, `postgres_scanner`, …) must be loaded by an init
  script before AMX connects, since AMX itself doesn't run `INSTALL` / `LOAD`.
- `:memory:` databases are useful for testing AMX itself, but every session starts
  empty — populate it with `INSERT` / `CREATE TABLE AS SELECT` before running `/setup`.
