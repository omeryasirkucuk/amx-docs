# Trino / Presto

Configure Trino as an AMX backend to introspect catalogs, schemas, tables, views,
materialized views, and columns, and write reviewed descriptions back as
`COMMENT ON TABLE` / `COMMENT ON COLUMN` / `COMMENT ON SCHEMA` /
`COMMENT ON VIEW` / `COMMENT ON MATERIALIZED VIEW` statements over the standard
Trino HTTP protocol. Trino and Presto share the same wire protocol, so the same
adapter targets both — Presto users connect with the same `trino://` URL form.

This page walks through registering a coordinator profile, picking between
Basic and JWT authentication, applying TLS settings for a production cluster,
and rolling out your first batch of generated comments.

## Prerequisites

- AMX installed with the Trino extra:

    ```bash
    pip install 'amx-cli[trino]'
    ```

    The `[trino]` extra pulls `trino[sqlalchemy]>=0.330` — pure-Python wheels on
    macOS, Linux, and Windows. No compiler required.

- A reachable Trino coordinator (Trino ≥ 351 for `COMMENT ON VIEW`, ≥ 400 for
  `COMMENT ON MATERIALIZED VIEW`). Presto coordinators work over the same client.
- For commenting: the role / catalog principal needs SELECT on the underlying
  table plus the connector-specific privilege required to write metadata
  (`USE` + `MODIFY` on Hive / Iceberg, etc.).
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

Pick `trino` from the backend menu:

```text
Select database backend (engine):
  ...
  trino   Host/port user/password (or JWT) + catalog - Trino / Presto; COMMENT ON DDL
  hive    Host/port user/password - HiveServer2; partial comment write-back (no columns)
  ...
> trino
```

### 3. Answer the connection prompts

```text
Trino coordinator host (e.g. trino.example.com or localhost):
  trino.prod.example.com
HTTP scheme (https for production, http for local Docker):
> https
Port (default 443 for https):
  443
Username (Trino user — used for query auditing even with JWT):
  amx
Authentication mode:
> basic
Password (leave blank for anonymous on a dev cluster): ••••••••••••••
Default catalog (leave blank to pick at command time):
  hive
Default schema (leave blank to pick at command time):
  warehouse
Verify TLS certificate? (Y for production, N only behind a TLS-inspecting proxy):
> yes
Path to private CA bundle (leave blank for system trust store):
```

Notes on each field:

- **Host** — coordinator hostname only. No `https://` prefix, no path; the wizard
  asks for the scheme separately.
- **HTTP scheme** — `https` for any production / cloud deployment. `http` is
  intentionally surfaced for local Docker (`trinodb/trino:latest` exposes
  plain `8080`).
- **Port** — the wizard pre-fills 443 for https and 8080 for http. Override
  freely if your cluster sits behind a non-standard load balancer.
- **Authentication mode** —
    - **`basic`** — HTTP Basic against the coordinator (`user:password`).
      The most common production setup.
    - **`jwt`** — Bearer token (Starburst Galaxy, OAuth-minted tokens). The
      wizard skips the password prompt and asks for the JWT instead.

    OAuth2 and Kerberos auth are *not* in the wizard; both require host-level
    flows that don't fit an interactive picker. Power users can hand-edit
    `~/.amx/config.yml` to set those auth modes — the adapter accepts them
    without crashing but the wizard won't surface them.

- **Default catalog** — Trino is 3-level (`catalog.schema.table`); the catalog
  is the connector pointer. Common values: `hive`, `iceberg`, `delta`,
  `tpch`, `memory`. Leave blank to be prompted at command time.
- **Default schema** — schema *inside* the chosen catalog. Reused as the
  `database` field on `DBConfig` so downstream commands stay backend-uniform.
- **Verify TLS / CA bundle** — only asked when scheme is `https`. Pin a CA
  bundle if your environment uses a private root; turn verify off **only**
  behind a TLS-inspecting proxy that refuses to present a distributable cert.

### 4. Activate and confirm

```text
> /use-db prod-trino
✓ Active DB profile → prod-trino [trino] trino.prod.example.com:443 catalog=hive (user amx)

> /connect
Testing prod-trino... ✓ connected (server: 481, coordinator: 4ixeg, latency: 215 ms)
```

### 5. Inspect the catalog

```text
> /schemas
catalog   schema       objects   tables   views
hive      warehouse    42        38       4
hive      staging      11        11       0
iceberg   default      18        14       4
system    runtime      —         —        —   (read-only system catalog)
```

The catalog picker surfaces every connector the coordinator has registered
(`SHOW CATALOGS`). The `system` catalog appears for completeness but AMX never
writes to it.

### 6. Run and apply

```text
> /run hive.warehouse.orders
[Profile] TABLESAMPLE BERNOULLI(1) on hive.warehouse.orders ... ok (1.4 s)
[LLM]     drafting 18 column descriptions ... ok (high: 14, medium: 3, low: 1)

> /apply
Write 18 comment(s) to hive.warehouse? [y/N]: y

COMMENT ON COLUMN "hive"."warehouse"."orders"."o_orderkey" IS 'Surrogate order id …';
COMMENT ON COLUMN "hive"."warehouse"."orders"."o_custkey"  IS 'Reference to customer …';
COMMENT ON TABLE  "hive"."warehouse"."orders" IS 'Master orders fact table …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

The DDL is dispatched with the comment text inlined as a SQL literal —
AMX's `quote_literal` escapes single quotes via the ANSI `''` doubling, so
descriptions that contain apostrophes ("the customer's address") land
correctly. The inlined form sidesteps a long-standing variance in how
different Trino connectors (hive, iceberg, delta) bind named parameters
inside DDL.

## Sample config

```yaml
db_profiles:
  prod-trino:
    backend: trino
    host: trino.prod.example.com
    port: 443
    user: amx
    password: keyring://amx/prod-trino/password   # blank when using JWT
    jwt_token: ""                                 # set when auth_mode = jwt
    catalog: hive
    database: warehouse                           # default schema inside catalog
    http_scheme: https
    verify: true
    tls_trusted_ca_file: ""                       # set on TLS-intercepting networks
    profiling_mode: sampled
    profiling_sample_size: 5000
    profiling_approximate: true                   # uses approx_distinct (HLL) for high-cardinality columns
active_db_profile: prod-trino
```

### JWT variant

```yaml
db_profiles:
  galaxy:
    backend: trino
    host: galaxy.starburst.io
    port: 443
    user: amx
    password: ""                                  # ignored when jwt_token is set
    jwt_token: keyring://amx/galaxy/jwt_token
    catalog: iceberg
    http_scheme: https
    verify: true
active_db_profile: galaxy
```

## Verify

1. `> /connect` — reports the Trino server version (e.g. `481`) and round-trip
   latency. First connect against a cold coordinator may take ~1–2 s; steady
   state is well under 500 ms.
2. `> /inspect` — confirms the catalog tree and which schemas have tables /
   views / materialized views.
3. `> /doctor` — verifies driver presence, profile activation, and that the
   coordinator's `/v1/info` endpoint reports `"starting":false`.

## Capabilities

| Surface | Supported | Note |
|---|---|---|
| Table comments (`COMMENT ON TABLE`) | ✓ | ANSI `COMMENT ON … IS '<literal>'`. |
| View comments (`COMMENT ON VIEW`) | ✓ | Trino ≥ 351. |
| Materialized view comments | ✓ | Trino ≥ 400. |
| Column comments | ✓ | `COMMENT ON COLUMN <catalog>.<schema>.<table>.<column>`. |
| Schema comments | ✓ | `COMMENT ON SCHEMA <catalog>.<schema>`. |
| Database / catalog comments | ✗ | Trino catalog descriptions live in `etc/catalog/<name>.properties` on the coordinator, not DDL. |
| Shared history store | ✗ | Row UPDATE for the `finish_run` lifecycle is connector-specific (Iceberg ✓, Hive raw ✗). Use another backend for AMX's run-history schema. |
| Bulk schema metadata cache | ✓ | Two-query path against `<catalog>.information_schema.tables` + `…columns`; graceful fallback for older Trino releases or connectors without `comment` columns. |

## Local development (Docker)

For a self-contained smoke test of the adapter:

```yaml
# trino-compose.yml
services:
  trino:
    image: trinodb/trino:latest
    ports:
      - "8080:8080"
    volumes:
      - ./catalog:/etc/trino/catalog:ro
```

```properties
# catalog/memory.properties
connector.name=memory
```

```properties
# catalog/tpch.properties
connector.name=tpch
```

```bash
docker compose -f trino-compose.yml up -d
# then in AMX:
#   /add-db-profile     → backend=trino, host=localhost, scheme=http, port=8080
#   /connect            → SELECT 1 succeeds against memory + tpch catalogs
#   /run tpch.sf1.orders
```

The `memory` connector accepts `CREATE TABLE … COMMENT '…'` and the full
column-comment writeback path, so it is the cleanest smoke test target.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `TrinoUserError: COLUMN_NOT_FOUND … 'comment'` from `information_schema.tables` | Older Trino release (≤ 350) or a connector that does not expose `comment` in `information_schema` | The adapter falls back to a no-comment listing path automatically. Comments still apply via DDL — only the bulk metadata cache renders as "no description yet". |
| `Access Denied: Cannot SELECT from table …` | Role lacks SELECT on the underlying connector source (Hive metastore, Iceberg table) | Grant SELECT on the catalog.schema.table via the connector's native ACL flow. AMX's `actionable_profile_error` surfaces a one-liner remediation. |
| `Catalog 'foo' not found` from `/schemas` | Catalog is not registered on the coordinator | Check `etc/catalog/<name>.properties` on the Trino server (or update the profile catalog name to one returned by `SHOW CATALOGS`). |
| `Connection refused` on `/connect` | Coordinator is offline, port closed, or HTTPS port pointed at a plain-HTTP service | Verify with `curl -sf http://<host>:<port>/v1/info`; check the wizard captured the correct `http_scheme`. |
| `SSL: CERTIFICATE_VERIFY_FAILED` | Corporate TLS interception, or self-signed cert in front of the coordinator | Pin `tls_trusted_ca_file:` to the org CA bundle. As a debug-only fallback, set `verify: false` in the YAML. |
| `COMMENT ON …` returns "operation not supported by connector" | The chosen connector (e.g. legacy Hive raw) does not support COMMENT writeback | Move the table to a connector that does (Iceberg, Delta, Hive with metastore-DDL enabled) or comment the underlying database directly using its native tooling. |

## See also

- [Backend overview](index.md) — capability matrix across every adapter.
- [Databricks](databricks.md) — sibling distributed-SQL adapter with a similar
  HTTP / token / catalog shape. If your data is in Databricks SQL warehouses
  (Unity Catalog) use the Databricks backend instead — its driver is purpose-built
  for that workspace shape.
- [TLS and proxies](../configuration/tls-and-proxies.md) — common corporate-TLS
  recovery walkthrough.
