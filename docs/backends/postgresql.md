# PostgreSQL

PostgreSQL is the reference adapter. Every other backend is normalised against the same
shape, so most AMX features were validated against Postgres first.

## Install

```bash
pip install "amx[postgresql]"
```

Driver: [`psycopg2-binary`](https://www.psycopg.org/).

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | Hostname or IP |
| `port` | no | Defaults to `5432` |
| `database` | yes | |
| `user` | yes | |
| `password` | yes | Stored in OS keychain when available |
| `sslmode` | no | `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full` |

## Sample `config.yml`

```yaml
db_profiles:
  prod_pg:
    backend: postgresql
    host: pg.internal.example.com
    port: 5432
    database: warehouse
    user: amx_reader
    sslmode: require
    profiling_mode: full
```

## Capabilities

- `COMMENT ON TABLE / VIEW / MATERIALIZED VIEW / COLUMN / SCHEMA / DATABASE` — all
  supported.
- Procedures, functions, sequences, triggers, and user-defined types are all listable
  through `/metadata` and `/db inspect`.
- Foreign keys, unique constraints, and check constraints are surfaced in the Profile
  Agent prompt.
- `TABLESAMPLE BERNOULLI` is used in `sampled` profiling mode.

## Required permissions

The minimum permissions to run AMX read-only:

```sql
GRANT CONNECT ON DATABASE warehouse TO amx_reader;
GRANT USAGE ON SCHEMA public TO amx_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO amx_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO amx_reader;
```

To allow comment write-back (`/apply`), the user also needs `COMMENT` privilege on the
relevant objects:

```sql
GRANT COMMENT ON TABLE public.t001 TO amx_writer;
```

In practice, most teams give AMX a dedicated role with `SELECT` everywhere it needs to read
plus ownership (or admin) on the schema for write-back.

## TLS

For corporate Postgres behind a managed CA, point AMX at the bundle via `sslrootcert` in
the SQLAlchemy URL or set the `PGSSLROOTCERT` environment variable. The Postgres adapter
uses the standard libpq env vars when present.

## Known limitations

- AMX does not read row-level security policies. If the AMX user can `SELECT` from a
  table, the Profile Agent assumes the visible sample is representative.
- `pg_stat_*` extensions are not currently consumed; profiling uses
  `pg_stats` and live `COUNT(*)` only.
