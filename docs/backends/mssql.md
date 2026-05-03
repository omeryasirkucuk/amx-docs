# SQL Server

## Install

```bash
pip install "amx[mssql]"
```

Driver: `pyodbc`. Requires **ODBC Driver 18 for SQL Server** at the OS level — see Microsoft's
[install guide](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server).

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `server` | yes | Hostname (or `host\instance`, or `host,port`) |
| `port` | no | Defaults to `1433` |
| `database` | yes | |
| `user` | yes | SQL auth user |
| `password` | yes | Stored in OS keychain when available |
| `driver` | no | ODBC driver name; defaults to `ODBC Driver 18 for SQL Server` |
| `encrypt` | no | `yes` (default) / `no` |
| `trust_server_certificate` | no | `yes` / `no` (default) |

Windows / Azure AD auth via `Authentication=ActiveDirectoryPassword` and friends works by
passing custom ODBC connection strings, but is not yet exposed as named fields in the
wizard.

## Sample `config.yml`

```yaml
db_profiles:
  mssql_prod:
    backend: mssql
    server: mssql.internal.example.com
    port: 1433
    database: warehouse
    user: amx_reader
    driver: ODBC Driver 18 for SQL Server
    encrypt: yes
    trust_server_certificate: no
    profiling_mode: sampled
```

## Capabilities

- Comment write-back via `sp_addextendedproperty` / `sp_updateextendedproperty` for the
  `MS_Description` extended property. The `IF EXISTS` branch handles the add-vs-update
  decision in a single block.
- Distinctive object types listable via `/metadata`: procedures, functions (FN/TF/IF
  subtypes), triggers, sequences, synonyms, partitions.

## Required permissions

```sql
CREATE LOGIN amx_reader WITH PASSWORD = '…';
USE warehouse;
CREATE USER amx_reader FOR LOGIN amx_reader;
GRANT SELECT ON SCHEMA::dbo TO amx_reader;
GRANT VIEW DEFINITION ON SCHEMA::dbo TO amx_reader;
-- For comment write-back:
GRANT ALTER ON SCHEMA::dbo TO amx_reader;
```

`VIEW DEFINITION` is needed so AMX can see procedure/function bodies in `/metadata`.

## Known limitations

- AMX uses `pyodbc` only. The newer `pymssql` driver and `ms-aad-auth` are not yet
  wired up.
- Comments written via extended properties don't appear in `INFORMATION_SCHEMA.COLUMNS.COLUMN_COMMENT`
  (because SQL Server doesn't have one) — instead they live in `sys.extended_properties`.
  AMX reads from there and downstream catalog tools that understand extended properties
  (e.g., Microsoft Purview, SQL Server Management Studio) will see them.
- Temporal tables are surfaced as regular tables; their history table appears separately
  with no special linkage in the AMX UI.
