# Databricks

Configure Databricks as an AMX backend to introspect Unity Catalog catalogs, schemas,
tables, views, and functions, and write reviewed descriptions back as
`COMMENT ON COLUMN` / `COMMENT ON TABLE` statements over a SQL warehouse. This page walks
through registering a workspace profile, recovering from corporate-TLS issues, and
applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `databricks-sql-connector` driver is included by default.
- A Databricks workspace with Unity Catalog enabled. (Hive-metastore-only workspaces are listable but cannot accept comment write-back via the SQL connector.)
- A running SQL warehouse — Serverless or Pro both work. Note its **HTTP path** (visible under "Connection details" on the warehouse page).
- A personal access token (PAT) for the workspace user — User Settings → Developer → Access tokens. Service-principal tokens work too.
- For commenting: the role / group needs `USE CATALOG`, `USE SCHEMA`, and `MODIFY` on the target objects. `SELECT` is enough for `/run` only.
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

Pick `databricks` from the backend menu:

```text
Select database backend (engine):
  ...
  databricks   SQL warehouse HTTP path + token - Unity Catalog
  ...
> databricks
```

### 3. Answer the connection prompts

```text
Databricks host (e.g. adb-xxxxxxxxxxxxxxxx.0.azuredatabricks.net):
  adb-1234567890123456.7.azuredatabricks.net
SQL warehouse HTTP path (e.g. /sql/1.0/warehouses/abc1234567890):
  /sql/1.0/warehouses/abc1234567890
Access token: ••••••••••••••••
Unity Catalog name (optional): main
Schema / database (optional): sales
Trusted CA bundle path (optional, for corporate/self-signed TLS):
Disable TLS certificate verification? (insecure; use only if a trusted CA bundle is not available) [y/N]: n
```

Notes on each field:

- **Host** — the workspace hostname only. No protocol, no path, no `?` query string.
- **HTTP path** — copy from the warehouse "Connection details" tab. The leading `/sql/1.0/warehouses/...` form is correct; don't paste the full JDBC URL.
- **Access token** — required. Stored in the OS keychain when one is available.
- **Unity Catalog name / Schema** — both optional. Filling them in pre-scopes `/schemas` and `/run` so commands don't pause to ask. Leave blank for cross-catalog discovery sessions.
- **Trusted CA bundle / Disable TLS verify** — only relevant on networks doing TLS interception. Order of preference: pin a CA bundle (most secure), then verify-off (only as a debug fallback).

!!! warning "Corporate TLS — `SSL: CERTIFICATE_VERIFY_FAILED` from `/connect`"
    On networks that MITM TLS (Zscaler, corporate proxies) the SQL connector rejects the cert by default. The fix:
    
    1. Get the bundle from your IT team (often `/etc/ssl/certs/ca-bundle.crt`).
    2. Re-run `/add-db-profile` (or edit the YAML) and set `tls_trusted_ca_file: /etc/ssl/certs/ca-bundle.crt`.
    3. As a temporary fallback only, answer `y` to "Disable TLS certificate verification". This is logged and surfaced in `/doctor` output so you remember to fix it.
    
    See [TLS and proxies](../configuration/tls-and-proxies.md) for the recovery walkthrough.

### 4. Activate and confirm

```text
> /use-db prod-dbx
✓ Active DB profile → prod-dbx [databricks] adb-1234.../sql/1.0/warehouses/abc1234567890 · main.sales

> /connect
Testing prod-dbx... ✓ connected (server: 14.3.x-photon, warehouse: adhoc-xs, latency: 412 ms)
```

### 5. Inspect the catalog

```text
> /schemas
catalog   schema     objects   tables   views
main      sales      18        16       2
main      catalog    7         7        0
hive_metastore  default  4        4        0   (read-only — no Unity Catalog)
```

Hive-metastore schemas appear in listings but are tagged read-only — `/apply` skips them
with `unity_catalog_required` rather than emitting a SQL that would silently no-op.

### 6. Run and apply

```text
> /run main.sales.customer
[Profile] TABLESAMPLE on main.sales.customer ... ok (2.1 s)
[LLM]     drafting 18 column descriptions ... ok (high: 13, medium: 4, low: 1)

> /apply
Write 18 comment(s) to main.sales? [y/N]: y

COMMENT ON COLUMN main.sales.customer.c_customer_sk IS 'Surrogate key …';
COMMENT ON COLUMN main.sales.customer.c_first_name  IS 'Given name …';
COMMENT ON TABLE  main.sales.customer IS 'Master customer record …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

```yaml
db_profiles:
  prod-dbx:
    backend: databricks
    host: adb-1234567890123456.7.azuredatabricks.net
    http_path: /sql/1.0/warehouses/abc1234567890
    access_token: keyring://amx/prod-dbx/access_token
    catalog: main
    database: sales
    tls_trusted_ca_file: ""        # set on TLS-intercepting networks
    tls_no_verify: false           # never set true outside debug
    profiling_mode: sampled
    profiling_sample_size: 5000
active_db_profile: prod-dbx
```

## Verify

1. `> /connect` — reports the cluster runtime version (e.g. `14.3.x-photon`) and round-trip latency. Latency over ~1.5 s usually means the warehouse is cold-starting; subsequent calls drop to ~200–400 ms.
2. `> /db inspect` — confirms catalog / schema counts and flags any Hive-metastore schemas as read-only.
3. `> /doctor` — verifies driver, profile activation, and that the workspace token is still valid (rejected tokens are surfaced as `Access token rejected by /api/2.0/clusters/list`).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `databricks.sql.exc.OperationalError: Connection refused` | Warehouse is stopped (Auto-stop kicked in) | Start the warehouse in the workspace UI or set Auto-stop to a longer interval; `/connect` will warm it on the next try |
| `INVALID_PARAMETER_VALUE: HTTP path is invalid` | The pasted path includes the `https://` host prefix | Re-run `/add-db-profile`; HTTP path is the leading-slash portion only (`/sql/1.0/warehouses/...`) |
| `SSL: CERTIFICATE_VERIFY_FAILED` on `/connect` | Corporate proxy is intercepting TLS | Pin `tls_trusted_ca_file:` to the org CA bundle (see warning above) |
| `unity_catalog_required` on `/apply` | Target schema lives in `hive_metastore` | Migrate the schema to Unity Catalog or skip — comment write-back over the SQL connector requires Unity Catalog |
| `EXECUTE_PERMISSION_DENIED on column …` mid-`/apply` | Role lacks `MODIFY` on the schema or table owner is a different group | Ask the catalog admin to grant `MODIFY ON SCHEMA main.sales TO <group>` or run `/apply` as the owning principal |
| `404 Not Found: /api/2.0/sql/queries` | Token belongs to a workspace that has the SQL endpoint disabled | Use a different workspace token, or a service-principal token from a workspace with SQL endpoints enabled |

## What's next

- [TLS and proxies](../configuration/tls-and-proxies.md) — full walkthrough for corporate-network TLS recovery, including the order in which AMX picks up CA bundles.
- [Profiling modes](../configuration/profiling-modes.md) — choose `metadata` to keep the warehouse cold for big sweeps; `sampled` for description drafting.
- [Run & Apply](../cli/run-and-apply.md) — what happens during the review wizard between `/run` and `/apply`.
