# ClickHouse

## Install

```bash
pip install "amx[clickhouse]"
```

Drivers: `clickhouse-connect`, `clickhouse-sqlalchemy`.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | |
| `port` | no | `8123` (HTTP) or `9000` (native); defaults to `8123` |
| `database` | yes | |
| `user` | yes | Defaults to `default` if you omit this |
| `password` | yes | Stored in OS keychain when available |
| `secure` | no | `true` for HTTPS / TLS native |

## Sample `config.yml`

```yaml
db_profiles:
  ch_prod:
    backend: clickhouse
    host: clickhouse.internal.example.com
    port: 8443
    database: events
    user: amx_reader
    secure: true
    profiling_mode: sampled
```

## Capabilities

- Comment write-back via `ALTER TABLE … MODIFY COMMENT` (ClickHouse 21.x+) per column.
- Distinctive object types listable via `/metadata`: materialized views, user-defined
  functions, **dictionaries** (ClickHouse's external-lookup primitive), skipping indices,
  MergeTree engine info.
- `SAMPLE` clause used in `sampled` profiling mode (only on tables with a sampling key).

## Engine-specific metadata

ClickHouse's MergeTree engine variants are first-class data points:

- `MergeTree` / `ReplicatedMergeTree` / `AggregatingMergeTree` / `CollapsingMergeTree` /
  `VersionedCollapsingMergeTree` / `SummingMergeTree` / `ReplacingMergeTree`.
- Sort key, partition key, sampling key.
- TTL.

These appear in the Profile Agent prompt because they're load-bearing — a column named
`event_time` on `MergeTree` partitioned by `toYYYYMM(event_time)` is almost certainly the
event timestamp, and the engine info confirms it.

## Required permissions

```xml
<!-- users.xml -->
<amx_reader>
    <password_sha256_hex>…</password_sha256_hex>
    <profile>readonly</profile>
    <quota>default</quota>
    <access_management>0</access_management>
</amx_reader>
```

For comment write-back, the user needs `ALTER` on the relevant tables.

## Known limitations

- **ClickHouse is blocked from shared mode.** ClickHouse cannot `UPDATE` rows the way
  AMX's `finish_run` requires, so the Enable wizard for the
  [shared history store](../collaboration/shared-history-store.md) refuses ClickHouse
  with a clear error. Use a Postgres / Snowflake / BigQuery / Databricks / Redshift /
  MySQL / MSSQL / Oracle profile for shared history.
- `Distributed` tables: AMX profiles the local replica, not the cluster sum. Row counts
  are local-only — a 100-shard cluster with 1B rows shows 10M per shard.
- ClickHouse Cloud's session-based authentication is not yet first-class; pass the API
  key as the password and use the standard HTTPS port.
