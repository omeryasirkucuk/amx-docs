# Databricks

AMX targets Databricks **Unity Catalog SQL warehouses**. Hive-metastore-only workspaces are
supported but won't expose volumes, lineage, or some of the richer object types.

## Install

```bash
pip install "amx[databricks]"
```

Drivers: `databricks-sql-connector` (used for the connection health check) and
`databricks-sqlalchemy` (used for metadata inspection and runtime SQLAlchemy flows).

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | Workspace hostname, e.g. `adb-1234567890123456.7.azuredatabricks.net` |
| `http_path` | yes | SQL warehouse HTTP path, e.g. `/sql/1.0/warehouses/abcd1234ef567890` |
| `access_token` | yes | Personal access token (PAT) — stored in OS keychain when available |
| `catalog` | yes | Unity Catalog catalog |
| `database` | yes | Schema (Databricks calls it `database` in the connector) |
| `tls_trusted_ca_file` | no | Path to a corporate / private CA bundle (see TLS notes) |
| `tls_no_verify` | no | `true` disables TLS verification — last resort only |

## Sample `config.yml`

```yaml
db_profiles:
  databricks-prod:
    backend: databricks
    host: adb-1234567890123456.7.azuredatabricks.net
    http_path: /sql/1.0/warehouses/abcd1234ef567890
    catalog: my_catalog
    database: my_schema
    tls_trusted_ca_file: ~/certs/internal-ca.pem
    tls_no_verify: false
    profiling_mode: sampled
```

## TLS notes

Databricks workspaces reached through a company proxy or private CA can fail with
`CERTIFICATE_VERIFY_FAILED`. AMX has multiple recovery paths:

- AMX uses Databricks' native Python SQL connector for the `/db connect` health check, while
  continuing to use the Databricks SQLAlchemy dialect for metadata inspection and normal
  runtime SQLAlchemy flows.
- `/db connect` tries Databricks connectivity in stages: saved profile first, then a CA
  bundle discovered from supported environment variables, then `tls_no_verify` as a last
  resort. The first successful recovery path is **saved back into the active DB profile**
  and printed in the terminal.
- Set a `tls_trusted_ca_file` in the Databricks DB profile to point at your corporate /
  root CA PEM bundle. Path may use `~` or environment variables such as
  `$HOME/certs/company-ca.pem`; AMX expands it before opening the Databricks connection.
- If the profile field is empty, AMX checks `AMX_DATABRICKS_TRUSTED_CA_FILE`,
  `DATABRICKS_TRUSTED_CA_FILE`, `REQUESTS_CA_BUNDLE`, then `SSL_CERT_FILE` and passes the
  first configured bundle to the Databricks connector.
- If you don't have the CA bundle yet, you can temporarily enable `tls_no_verify: true` —
  insecure, last resort for internal troubleshooting.

The `/db tls [on|off] [ca_path|clear]` slash command is a quick way to view or set these
fields without re-running the wizard.

## Capabilities

- Comment write-back via `COMMENT ON COLUMN` (Unity Catalog SQL warehouse).
- Distinctive object types listable via `/metadata`: user functions, **volumes** (Unity
  Catalog file storage), external tables.
- `TABLESAMPLE` used in `sampled` profiling mode.
- Falls back to lightweight metadata + samples when row-count statistics are unavailable
  in `full` mode, rather than running an unbounded query.

## Required permissions

The Unity Catalog role needs:

- `USE CATALOG` and `USE SCHEMA` on the targets.
- `SELECT` on the tables / views.
- `MODIFY` (or `OWN`) for comment write-back.

## Known limitations

- Hive-metastore-only workspaces don't expose volumes; AMX surfaces this as a missing
  capability on `/db inspect`.
- Photon-specific stats are not consumed; AMX uses `INFORMATION_SCHEMA.STATISTICS` only.
- Lineage from Unity Catalog is not yet read by AMX (planned).
