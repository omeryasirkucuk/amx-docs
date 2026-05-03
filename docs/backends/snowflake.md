# Snowflake

Drivers: `snowflake-connector-python`, `snowflake-sqlalchemy`.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `account` | yes | e.g. `xy12345.eu-west-1` |
| `user` | yes | |
| `password` | conditional | Required for password auth |
| `private_key_path` | conditional | For key-pair auth |
| `private_key_passphrase` | no | If the private key is encrypted |
| `authenticator` | no | `externalbrowser` for SSO, `oauth`, etc. |
| `warehouse` | yes | Compute warehouse for AMX queries |
| `role` | yes | The role used for introspection + write-back |
| `database` | yes | |
| `schema` | yes | Default schema; can be overridden per-run |

## Sample `config.yml`

```yaml
db_profiles:
  snow_prod:
    backend: snowflake
    account: xy12345.eu-west-1
    user: AMX_SVC
    warehouse: AMX_WH
    role: AMX_ROLE
    database: ANALYTICS
    schema: PUBLIC
    private_key_path: ~/.snowflake/amx.p8
    profiling_mode: sampled
```

## Capabilities

- Comment write-back via Snowflake `COMMENT` statements. Supported on databases, schemas,
  tables, views, materialized views, and columns.
- Distinctive object types listable via `/metadata`: procedures, functions, sequences,
  **tasks**, **stages**, **shares**, **external tables**.
- `SAMPLE` / `SAMPLE BLOCK` used in `sampled` profiling mode.
- Native Snowflake type system mapped to the universal type model — `VARIANT`, `ARRAY`,
  `OBJECT` flagged as semi-structured.

## Warehouse load

AMX is profiling-aware:

- `metadata` mode skips per-column data reads entirely — recommended for large warehouses
  in dev / sandbox.
- `sampled` mode uses `SAMPLE` clauses and respects `profiling_max_rows`.
- `full` mode is the default but **falls back to `sampled` behaviour automatically when
  table statistics report more rows than `profiling_max_rows`** so a wildly oversized
  table doesn't accidentally start a sequential scan.

See [Profiling modes](../configuration/profiling-modes.md) for the full breakdown.

## Required permissions

Read-only:

```sql
USE ROLE SECURITYADMIN;
CREATE ROLE AMX_ROLE;
GRANT USAGE ON WAREHOUSE AMX_WH TO ROLE AMX_ROLE;
GRANT USAGE ON DATABASE ANALYTICS TO ROLE AMX_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE ANALYTICS TO ROLE AMX_ROLE;
GRANT SELECT ON ALL TABLES IN DATABASE ANALYTICS TO ROLE AMX_ROLE;
GRANT SELECT ON FUTURE TABLES IN DATABASE ANALYTICS TO ROLE AMX_ROLE;
```

To allow comment write-back, the role also needs `OWNERSHIP` (or `MODIFY`) on the
relevant objects.

## Auth options

- **Password** — fine for evaluation, not recommended for production.
- **Key-pair** — recommended. Generate a key, register the public half via
  `ALTER USER … SET RSA_PUBLIC_KEY = …`, point AMX at the private key path.
- **SSO (externalbrowser)** — interactive only; not suitable for unattended use.
- **OAuth** — supported via the `authenticator: oauth` field plus an `OAUTH_TOKEN` env
  var or value.

## Known limitations

- Snowflake row-level access policies are honoured but invisible to AMX; the Profile Agent
  sees only what the AMX role can `SELECT`.
- `STREAM`, `PIPE`, and `DYNAMIC TABLE` objects are not currently surfaced — they live in
  Snowflake-specific information schema views that are not yet wired up.
