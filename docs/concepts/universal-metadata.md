# Universal Metadata Interface

AMX presents 10 different database backends through a single, backend-neutral entity model.
The seam that makes this work is the **Universal Metadata Interface** in `amx.core.metadata`.

## Why it exists

Every backend has its own way to expose:

- Column types (`NUMBER(8)` vs `int8` vs `BIGINT`).
- Constraints (declared FKs vs informational FKs vs none).
- Comments (`COMMENT ON COLUMN` vs `ALTER … MODIFY COMMENT` vs
  `sp_addextendedproperty`).
- First-class object types (Oracle has packages, ClickHouse has dictionaries, DuckDB has
  macros, Databricks has volumes, Snowflake has shares, BigQuery has external tables).

If the agents and review wizard had to handle these directly, AMX would be ten programs in a
trench coat. Instead, every adapter normalises into the same shape — `AbstractEntity` —
and the agents only ever see that shape.

## `AbstractEntity`

`AbstractEntity` is a dataclass that captures the canonical view of a table or column:

- Identity (database, schema, table, optional column).
- Type information, normalised across backends.
- Comments (current value).
- Constraints (PK, FKs in / out, unique, check).
- Profiling signals (row count, null count, distinct count, samples) when available.
- Backend-distinctive metadata that doesn't fit elsewhere lives under `extra` so the
  Profile Agent prompt can include it without expanding the canonical schema.

The full shape is part of the public Python API — see [API reference](../api/reference.md).

## `UniversalMetadataAdapter`

`UniversalMetadataAdapter` is the per-backend mapper. Each `amx.db.adapters.*` module
contributes:

- A SQLAlchemy URL builder for that backend.
- An introspection layer that walks information_schema (or backend equivalent) and
  populates `AbstractEntity` instances.
- A comment writer (`apply_comment`) that translates a description into the backend's native
  comment SQL.
- A `BackendCapabilities` flag set declaring which list operations the connector even
  attempts.

`BackendCapabilities` is what makes errors actionable. ClickHouse cannot `UPDATE`
arbitrary tables, so the `supports_shared_history` flag is `False` and the
[shared history store](../collaboration/shared-history-store.md) Enable wizard refuses
ClickHouse with a clear error rather than failing midway through bootstrap.

## What you get for free

Because every adapter normalises into the same shape:

- The same review wizard handles every backend.
- `/metadata edit` and `/metadata monitor` work identically across PostgreSQL, Snowflake,
  Databricks, BigQuery, and the rest.
- `/history compare` can pivot runs across different backends side by side.
- The Profile Agent prompt is backend-agnostic — it sees columns and types, not driver
  quirks.
- `infer_table_metadata` (the headless API) returns the same dict shape regardless of
  which backend produced the source data.

## What's still backend-specific

Some operations don't translate cleanly. AMX is explicit about these rather than silently
no-op'ing:

- **MySQL** has no `COMMENT ON SCHEMA`. Schema comments raise rather than silently no-op.
- **DuckDB** schema-level comments are unsupported in DuckDB 1.x — same treatment.
- **BigQuery** project-level descriptions are blocked before connection (the API doesn't
  expose them).
- **ClickHouse** does not support `UPDATE` semantics required by `finish_run` in shared
  mode — blocked at Enable.

Each of these surfaces with the exact backend name and the recommended workaround.

## Backend-distinctive object types

Tables and views are first-class everywhere, but each backend exposes its own special
object types under the same `list_*` interface:

| Backend | Distinctive object types |
|---|---|
| PostgreSQL | procedures, functions, sequences, triggers, UDTs |
| Snowflake | procedures, functions, sequences, tasks, stages, shares, external tables |
| Databricks | user functions, **volumes**, external tables |
| BigQuery | routines (procedures + functions), external tables |
| MySQL | procedures, functions, triggers, **events** (scheduled jobs), partition strategy |
| Oracle | materialized views, procedures, functions, **packages**, triggers, sequences, synonyms, UDTs |
| SQL Server | procedures, functions, triggers, sequences, synonyms, partitions |
| Redshift | materialized views, procedures, UDFs, **datashares**, **external tables** (Spectrum) |
| ClickHouse | materialized views, UDFs, **dictionaries**, skipping indices |
| DuckDB | sequences, functions, **macros**, attached databases (Parquet/S3/Postgres scanner) |

Each adapter advertises its capabilities so unsupported types short-circuit cleanly. The
Profile Agent currently focuses on tables, views, and materialized views; non-table object
types are listed via `/metadata` for inspection but are not part of the inference loop yet.

## Where this lives in code

| Concern | Module | Stable? |
|---|---|---|
| `AbstractEntity` | `amx.core.metadata` | Yes — public API |
| `UniversalMetadataAdapter` | `amx.core.metadata` | Yes — public API |
| Per-backend adapters | `amx.db.adapters.*` | No — internal |
| Capability flags | `amx.db.capabilities` | No — internal but capability-flag *names* are stable |

The two public symbols are tracked under [`amx.core`](../api/index.md). Internal modules
can move between releases.
