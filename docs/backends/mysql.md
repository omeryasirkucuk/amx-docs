# MySQL / MariaDB

## Install

```bash
pip install "amx[mysql]"
```

Drivers: `pymysql`, `cryptography` (for `caching_sha2_password`).

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | |
| `port` | no | Defaults to `3306` |
| `database` | yes | MySQL "schema" |
| `user` | yes | |
| `password` | yes | Stored in OS keychain when available |
| `ssl_ca` | no | Path to CA bundle for TLS |

## Sample `config.yml`

```yaml
db_profiles:
  mysql_prod:
    backend: mysql
    host: mysql.internal.example.com
    port: 3306
    database: orders
    user: amx_reader
    profiling_mode: full
```

## Capabilities

- Comment write-back via `ALTER TABLE … MODIFY COLUMN … COMMENT '…'` and
  `ALTER TABLE … COMMENT '…'`.
- Distinctive object types listable via `/metadata`: stored procedures, functions,
  triggers, **events** (MySQL's scheduled jobs), partition strategy, storage engine.

## Required permissions

```sql
CREATE USER 'amx_reader'@'%' IDENTIFIED BY '…';
GRANT SELECT ON orders.* TO 'amx_reader'@'%';
-- For comment write-back:
GRANT ALTER ON orders.* TO 'amx_reader'@'%';
```

## Known limitations

- **MySQL has no `COMMENT ON SCHEMA`.** Schema-level comments raise rather than silently
  no-op. The closest equivalent is the `INFORMATION_SCHEMA.SCHEMATA.SCHEMA_COMMENT` field
  which is read-only at the SQL level.
- MySQL stores comments per-column inside the table DDL; updating one column rewrites the
  full column definition. AMX handles this transparently but on a very wide table the
  `ALTER TABLE` can take a moment.
- Profiling uses `INFORMATION_SCHEMA.TABLES.TABLE_ROWS` for row-count estimates in
  `sampled` mode. For InnoDB this is approximate; for MyISAM it's exact.
- MariaDB is supported via the same adapter — set `backend: mysql` and point at the
  MariaDB instance. Engine-specific quirks (e.g., COLUMNSTORE) are not separately
  surfaced.
