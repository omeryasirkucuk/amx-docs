# DuckDB

Configure DuckDB as an AMX backend for embedded, single-file analytical work — perfect
for prototyping AMX against a sample dataset before pointing it at a production warehouse,
or for documenting Parquet / S3 collections via DuckDB's external scanners. AMX
introspects tables, views, sequences, functions, macros, and attached databases, and
writes reviewed descriptions back as `COMMENT ON COLUMN` / `COMMENT ON TABLE` statements.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `duckdb` driver is included by default.
- Either:
    - A `.duckdb` file you own (created by another DuckDB session or downloaded), OR
    - The `:memory:` choice, which spins up an ephemeral instance you populate inline (good for one-off sample sets).
- Optional: Parquet / CSV / Iceberg / Postgres / SQLite files or endpoints you want to attach as scanners.
- An active LLM profile (or skip ahead with `/add-llm-profile`).

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add a database profile

```text
> /add-db-profile
```

Pick `duckdb` from the backend menu:

```text
Select database backend (engine):
  ...
  duckdb     Single-file or in-memory; no host/auth (analytical, embedded)
  ...
> duckdb
```

### 3. Answer the connection prompt

```text
Path to .duckdb file (or ':memory:' for an ephemeral database): /Users/me/data/sales.duckdb
```

There's only one prompt — DuckDB has no host, port, user, or password concept.

- **File path** — absolute or relative path to a `.duckdb` file. AMX creates the file if it doesn't exist (so you can use this profile to seed a brand-new database).
- **`:memory:`** — type the literal string. The instance dies when you `/exit` AMX. Useful for short-lived demos and tutorials.

!!! tip "Path vs `:memory:` — pick by use case"
    - **Path** — when you want comments to persist between AMX sessions (the most common case). Reuse the same `.duckdb` across analyses; comments survive in the file.
    - **`:memory:`** — for documentation drills against attached files (Parquet, CSV) where you don't need persistence. Anything you `/apply` is lost when AMX exits.

### 4. Activate and confirm

```text
> /use-db local-duck
✓ Active DB profile → local-duck [duckdb] /Users/me/data/sales.duckdb

> /connect
Testing local-duck... ✓ connected (server: DuckDB 0.10.2, file size: 234 MB)
```

### 5. (Optional) Attach Parquet / CSV / Postgres scanners

DuckDB can introspect external sources via attached databases or `read_parquet` /
`read_csv` views. AMX picks them up alongside native tables — you don't need to teach
AMX about scanners, just have them registered in the DuckDB session.

```text
> /sql ATTACH 'postgres:dbname=analytics host=db.example.com user=amx password=…' AS pg (TYPE postgres);
> /sql CREATE VIEW sales.daily_orders AS SELECT * FROM read_parquet('s3://acme-data/orders/*.parquet');
```

After attaching, run `/schemas` again — `pg` will appear as a database alongside the
local `main`.

### 6. Inspect schemas and tables

```text
> /schemas
database   schema   objects   tables   views   matviews   external?
main       main     21        16       2       3          no
pg         public   118       104      10      4          yes (postgres scanner)

> /tables main.main
schema  name              kind    rows         comment?
main    customer          TABLE   2,450,118    no
main    customer_address  TABLE   2,450,118    no
main    inventory         TABLE   45,318,234   yes
```

### 7. Run and apply

```text
> /run main.customer
[Profile] USING SAMPLE on main.customer ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 13, medium: 4, low: 1)

> /apply
Write 18 comment(s) to /Users/me/data/sales.duckdb? [y/N]: y

COMMENT ON TABLE  main.customer IS 'Master customer record …';
COMMENT ON COLUMN main.customer.c_customer_sk IS 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

For attached external databases (`pg.public.…`), comment write-back goes to the **attached
backend**, not the DuckDB file — so attaching a Postgres database lets you use AMX with
DuckDB as the orchestrator while writing comments back to the real Postgres catalog.

## Sample config

File-backed:

```yaml
db_profiles:
  local-duck:
    backend: duckdb
    database: /Users/me/data/sales.duckdb
    profiling_mode: full       # full is fine for local files — no warehouse cost
active_db_profile: local-duck
```

In-memory:

```yaml
db_profiles:
  ephemeral:
    backend: duckdb
    database: ":memory:"
```

## Verify

1. `> /connect` — server version + file size (or `(ephemeral)` for `:memory:`).
2. `> /db inspect` — counts of tables, views, sequences, functions, macros, and attached databases.
3. `> amx doctor` — confirms the DuckDB driver is loaded and the file is readable.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `duckdb.IOException: IO Error: Cannot open file "/Users/me/data/sales.duckdb": Permission denied` | The user running AMX can't read/write the file | `chmod +rw` the file or move it under your home dir |
| `duckdb.CatalogException: Table with name customer does not exist!` after attach | Attached database wasn't registered before `/run` | Re-run the `ATTACH` command in the same session, or persist it in a startup SQL file |
| `external_history_store_unsupported` from `/history-store enable` | DuckDB doesn't support multi-process write — sharing the history store across machines doesn't make sense | Host the history store on PostgreSQL or another transactional backend; keep DuckDB as the data source |
| `/apply` writes to the DuckDB file but Postgres-attached comments don't appear | Comments on attached objects go to the attached backend; you need write privileges there too | Confirm the Postgres user in the `ATTACH` connection string has `COMMENT` privilege on the target schema |
| File grows large after several `/apply` runs | DuckDB doesn't auto-compact `.duckdb` files | `> /sql CHECKPOINT;` to force a write barrier; `> /sql VACUUM;` to reclaim space |
| `duckdb.OutOfMemoryException` mid-run | Full scan of a wide table exceeded the default memory limit | `> /sql SET memory_limit='4GB';` or switch to `profiling_mode: sampled` |

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — `full` mode is the natural default for DuckDB; warehouse cost concerns don't apply.
- [Documents data source](../data-sources/documents.md) — pair a DuckDB profile with the RAG agent to draft descriptions from a folder of CSVs / Parquets you just attached.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes and per-row error handling on `/apply`.
