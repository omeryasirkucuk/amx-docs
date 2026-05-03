# Oracle

Driver: `oracledb` (the modern replacement for `cx_Oracle`). No client library install
required for thin mode.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | |
| `port` | no | Defaults to `1521` |
| `service_name` | conditional | **Preferred.** Use this for modern Oracle deployments |
| `sid` | conditional | Legacy Oracle; use only if `service_name` is unavailable |
| `user` | yes | |
| `password` | yes | Stored in OS keychain when available |
| `dsn` | no | Full TNS-style DSN, overrides host/port/service_name |

Provide either `service_name` or `sid`, not both. AMX raises a clear error if both are set.

## Sample `config.yml`

```yaml
db_profiles:
  oracle_prod:
    backend: oracle
    host: oracle.internal.example.com
    port: 1521
    service_name: ORCLPDB1
    user: AMX_READER
    profiling_mode: sampled
```

## Capabilities

- Comment write-back via `COMMENT ON COLUMN … IS '…'` and `COMMENT ON TABLE … IS '…'`.
- Distinctive object types listable via `/metadata`: materialized views, procedures,
  functions, **packages** (PL/SQL bundles, Oracle-distinctive), triggers, sequences,
  synonyms, user-defined types.
- Oracle's case-folding (identifiers default to upper-case) is preserved in AMX output —
  table names show as `T001` not `t001`.

## Required permissions

```sql
CREATE USER amx_reader IDENTIFIED BY '…';
GRANT CREATE SESSION TO amx_reader;
GRANT SELECT ANY TABLE TO amx_reader;       -- Or per-schema SELECT
GRANT SELECT ANY DICTIONARY TO amx_reader;
-- For comment write-back:
GRANT COMMENT ANY TABLE TO amx_reader;
```

In tight environments, replace `SELECT ANY TABLE` with explicit `SELECT` grants per schema
and `SELECT_CATALOG_ROLE` for dictionary access.

## Known limitations

- AMX runs Oracle in thin mode (no Oracle Client library). Some advanced features (Oracle
  Wallet auth, OCI Vault) are not currently supported through this code path.
- Long-form `LONG` and `LONG RAW` columns are surfaced as types but AMX does not sample
  them — they're treated as opaque blobs at profiling time.
- `MATERIALIZED VIEW LOG` objects are not separately listed; they appear under the parent
  materialized view.
