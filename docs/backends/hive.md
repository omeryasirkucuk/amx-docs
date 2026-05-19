# Hive (HiveServer2)

Configure HiveServer2 as an AMX backend to introspect Hive databases (==schemas),
tables, views, and columns, and write **table-level**, **view-level**, and
**database-level** descriptions back via `ALTER TABLE … SET TBLPROPERTIES` and
`ALTER DATABASE … SET DBPROPERTIES`. The adapter targets the **HiveServer2 SQL
gateway** (Thrift) — not the bare Hive Metastore. HiveServer2 lives in many
places and the wizard accepts all of them; see [Deployment matrix](#deployment-matrix)
below for copy-paste configs.

!!! warning "Column-comment write-back is intentionally disabled"
    Hive's only path for writing column comments is
    `ALTER TABLE <db>.<t> CHANGE col col <TYPE> COMMENT '<text>'`,
    which requires re-declaring the original column type. Complex types
    (`struct<...>`, `map<...>`, `array<...>`, `uniontype<...>`, generics
    nested inside generics) round-trip lossily through Hive's catalog
    representation, and a wrong type re-emission corrupts the table.
    AMX's Hive adapter therefore ships with `column_comments=False` —
    `/apply` raises `UnsupportedDatabaseOperation` cleanly upstream.

    Apply column comments through your data-definition tooling (dbt,
    Apache Atlas) instead, or migrate the table to a backend with
    native column-comment DDL: [Trino](trino.md),
    [Databricks](databricks.md), or [PostgreSQL](postgresql.md).

## Prerequisites

- AMX installed with the Hive extra:

    ```bash
    pip install 'amx-cli[hive]'
    ```

    The `[hive]` extra pulls bare `pyhive>=0.7` + `thrift>=0.16` +
    `thrift-sasl>=0.4.3` + `pure-sasl>=0.6`. The legacy `sasl` C
    extension is **deliberately avoided** — it has no Windows wheels
    for modern Pythons and fails to build on macOS. `thrift-sasl`
    routes through pure-Python `pure-sasl`, which wheels cleanly on
    macOS, Linux, and Windows.

- A reachable HiveServer2 endpoint (Thrift on TCP). HiveServer2 ships
  with every Hadoop / Hive distribution.
- For commenting: the principal needs `SELECT` on the underlying
  table plus `ALTER` on the database — or the equivalent grant
  through Ranger / Sentry / Lake Formation as your stack requires.
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

Pick `hive` from the backend menu:

```text
Select database backend (engine):
  ...
  hive    Host/port user/password - HiveServer2; partial comment write-back (no columns)
  ...
> hive
```

The wizard prints a deployment-disambiguation banner so users on a
Databricks workspace know to pick the Databricks backend instead:

```text
Hive backend targets HiveServer2 (Thrift). Use this for local Docker,
on-prem Hadoop, EMR, and Cloudera CDH/CDP clusters. Databricks legacy
'hive_metastore' catalogs belong to the Databricks backend, not this one.
```

### 3. Answer the connection prompts

```text
HiveServer2 host (e.g. hive.example.com or localhost):
  hive.prod.example.com
Port (default 10000 for HiveServer2):
  10000
Authentication mode (NOSASL is for local dev clusters only):
> PLAIN
Username (Hive user — also recorded in query history):
  amx
Password: ••••••••••••
Default database / schema (leave blank to pick at command time):
  warehouse
```

Notes on each field:

- **Host** — HiveServer2 hostname. No scheme prefix; Thrift is plain
  TCP (10000) or SASL-over-TCP (10000) by default. TLS-fronted
  deployments (HS2 behind stunnel / nginx) use `tls_trusted_ca_file:`
  in the YAML — see `~/.amx/config.yml` sample below.
- **Port** — `10000` is the universal HS2 default. Some EMR / on-prem
  clusters relocate it behind a load balancer; check
  `hive.server2.thrift.port` on the cluster.
- **Authentication mode** —
    - **`PLAIN`** — SASL PLAIN; username + password (the workhorse
      against production HS2 with a SASL-aware authenticator,
      including LDAP-backed setups that the cluster admin wires up
      through `hive.server2.authentication=LDAP`).
    - **`LDAP`** — Same wire format as PLAIN but the credential is
      validated against an LDAP directory (Cloudera / EMR pattern).
    - **`NOSASL`** — Plaintext, no authentication. Use **only** for
      local Docker dev clusters; never against a production HS2.
- **Username / Password** — Username always required (Hive logs it in
  query history). Password skipped for NOSASL.
- **Default database** — Hive treats databases as schemas; the
  `database` field IS the default schema. Leave blank to be prompted
  at command time.

!!! info "Kerberos / Cloudera CDP"
    Wizard-collected auth stops at PLAIN / LDAP / NOSASL. For
    Kerberos (the Cloudera CDH/CDP default) hand-edit
    `~/.amx/config.yml`:

    ```yaml
    db_profiles:
      cdp-hive:
        backend: hive
        host: hive.cdp.example.com
        port: 10000
        user: amx@EXAMPLE.COM
        password: ""
        auth_mode: KERBEROS
        database: warehouse
    ```

    Then `kinit amx@EXAMPLE.COM` before launching `amx`. PyHive's
    Thrift transport picks up the active ticket via the system's
    `krb5` library.

### 4. Activate and confirm

```text
> /use-db prod-hive
✓ Active DB profile → prod-hive [hive] warehouse @ hive.prod.example.com:10000 (user amx, PLAIN)

> /connect
Testing prod-hive... ✓ connected (server: 4.0.0, latency: 318 ms)
```

### 5. Inspect the catalog

```text
> /schemas
schema       objects   tables   views
warehouse    42        38       4
staging      11        11       0
gold         24        20       4
```

Hive has no catalog above the database, so the listings are flat —
just schemas and their objects.

### 6. Run and apply

```text
> /run warehouse.orders
[Profile] SELECT … FROM warehouse.orders LIMIT 5 ... ok (1.7 s)
[LLM]     drafting 12 column descriptions + 1 table description ... ok

> /apply
Write 1 comment(s) to warehouse? [y/N]: y

ALTER TABLE `warehouse`.`orders` SET TBLPROPERTIES (
  'comment' = 'Master orders fact table …'
);
(1/1 written)
ℹ /apply skipped 12 column comment(s) — column write-back is disabled on Hive
✓ /apply finished. Audit trail: /history show <run-id>
```

When `/apply` encounters column comments on a Hive profile it surfaces
the capability gap as a single informational line and continues with
the table / view / database writes — no partial-success ambiguity.
See the warning at the top of this page for the deliberate "why".

## Deployment matrix

Hive lives in several different stacks. AMX's wizard covers all four
mainstream deployments without code changes — only the auth mode and
hostname conventions shift.

### Local Docker (development)

```yaml
db_profiles:
  local-hive:
    backend: hive
    host: localhost
    port: 10000
    user: amx
    password: ""
    auth_mode: NOSASL
    database: default
active_db_profile: local-hive
```

```bash
docker run -d --name amx-hive \
  -p 10000:10000 \
  -e SERVICE_NAME=hiveserver2 \
  -e 'SERVICE_OPTS=-Dhive.server2.authentication=NOSASL' \
  apache/hive:4.0.0
```

`apache/hive:4.0.0` boots HMS + HiveServer2 against a Derby metastore
in one container. Cold start takes ~1–2 minutes; subsequent
connections are instant.

### On-premises Hadoop (Cloudera CDH, HDP)

```yaml
db_profiles:
  cdh-hive:
    backend: hive
    host: hive.internal.example.com
    port: 10000
    user: amx
    password: keyring://amx/cdh-hive/password
    auth_mode: PLAIN          # or LDAP — wire format is the same
    database: warehouse
active_db_profile: cdh-hive
```

Grant Ranger / Sentry policy: `SELECT` on `warehouse.*`, `ALTER` on
`warehouse` for the comment write-back path.

### AWS EMR

```yaml
db_profiles:
  emr-hive:
    backend: hive
    host: ip-10-0-1-23.eu-west-1.compute.internal
    port: 10000
    user: hadoop
    password: keyring://amx/emr-hive/password
    auth_mode: PLAIN
    database: analytics
active_db_profile: emr-hive
```

Connect to the EMR master node either through a bastion / VPN or via
the AWS Session Manager port-forward. EMR's PLAIN auth validates
against the operating-system user database by default; LDAP requires
explicit cluster configuration.

### Cloudera CDP (Kerberos)

```yaml
db_profiles:
  cdp-hive:
    backend: hive
    host: hive.cdp.example.com
    port: 10000
    user: amx@EXAMPLE.COM
    password: ""
    auth_mode: KERBEROS
    database: warehouse
active_db_profile: cdp-hive
```

Outside the wizard. `kinit amx@EXAMPLE.COM` before launching `amx`;
the Thrift transport picks up the active ticket from the system
keychain (`/etc/krb5.conf`).

## Where Hive does NOT live (and what to use instead)

- **Standalone Hive Metastore (HMS Thrift only, no HiveServer2)** —
  AMX's adapter contract includes profiling SQL (`column_stats_sql`,
  `column_sample_sql`), which a Metastore-only deployment cannot
  serve. Use [Trino](trino.md) configured with the `hive` connector
  pointing at your HMS instead — Trino's catalog API delegates to
  HMS for object discovery and then runs the actual SQL itself.
- **Databricks legacy `hive_metastore` catalog** — Databricks
  exposes its built-in `hive_metastore` through the SQL warehouse,
  not through HiveServer2. Use [Databricks](databricks.md) with the
  workspace token / HTTP path instead.

The wizard surfaces both alternatives in the banner shown above so
users don't accidentally configure the wrong backend.

## Verify

1. `> /connect` — reports the HS2 server version (e.g. `4.0.0`) and
   round-trip latency. First connect on a cold cluster takes a few
   seconds; steady state is well under 500 ms.
2. `> /db inspect` — confirms schema counts and which schemas have
   tables / views.
3. `> /doctor` — verifies driver presence (`pyhive`, `pure-sasl`),
   profile activation, and that the configured auth mode is one of
   the supported values.

## Capabilities

| Surface | Supported | Note |
|---|---|---|
| Table comments | ✓ | `ALTER TABLE <db>.<t> SET TBLPROPERTIES ('comment' = '…')`. |
| View comments | ✓ | `ALTER VIEW <db>.<v> SET TBLPROPERTIES ('comment' = '…')`. |
| Schema / Database comments | ✓ | `ALTER DATABASE <db> SET DBPROPERTIES ('comment' = '…')`. Hive treats database == schema. |
| Materialized view comments | ✗ | Hive 3.x materialized views exist but the write-back DDL surface varies by execution engine. |
| Column comments | ✗ | See warning at the top — full column-redefinition risk is too high. |
| Shared history store | ✗ | Row-level UPDATE is partition- / transactional-table-only; cannot host AMX's run-history schema. |
| Bulk schema metadata cache | ✓ | Two-query path against `information_schema.{tables,columns}` on Hive 3+; per-table `DESCRIBE FORMATTED` parser fallback on Hive 2.x. |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ImportError: The 'pyhive' package is required` from `/connect` | Hive extra not installed | `pip install 'amx-cli[hive]'` |
| `OSError: failed building wheel for sasl` during `pip install` | Tried `pip install pyhive[hive]` directly (pulls the legacy C extension) | Use the AMX extra (`pip install 'amx-cli[hive]'`); it routes through `pure-sasl` instead |
| `TTransportException: SASL/PLAIN auth failed` | Cluster expects LDAP but profile says `PLAIN` (or vice versa) | Check `hive.server2.authentication` on the cluster and adjust `auth_mode` in the profile |
| `Hive SASL / Kerberos handshake failed` | Missing or expired Kerberos ticket | `kinit <principal>`; verify the keytab path and KRB5 config |
| `AuthorizationException: Permission denied` on `/apply` | Principal lacks `ALTER` on the target database | Grant via Ranger / Sentry / Lake Formation (or `GRANT ALTER ON DATABASE …` directly on simpler deployments) |
| `/apply` reports "column write-back is disabled on Hive" | Capability gap by design — see warning above | Apply column comments via dbt / Atlas, or migrate the table to a backend with native column-comment DDL |
| `DESCRIBE FORMATTED` shows the table-level comment but `bulk_schema_metadata` returns `None` | Hive 2.x cluster lacks an initialised `information_schema` — fallback parser is correct but cached entry was filled before the writeback | `> /db cache clear`, then re-list — the per-table parser will pick up the new comment |

## See also

- [Backend overview](index.md) — capability matrix across every adapter.
- [Trino / Presto](trino.md) — sibling adapter for HMS-backed tables through a modern query engine. The recommended alternative when HiveServer2 isn't running but the Metastore is.
- [Databricks](databricks.md) — Databricks workspace legacy `hive_metastore` catalog lives here, not the Hive backend.
