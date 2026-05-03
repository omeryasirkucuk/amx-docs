# Oracle

Configure Oracle Database (12c+, including Oracle Cloud Autonomous DB and RAC) as an
AMX backend to introspect tables, views, materialized views, packages, procedures,
triggers, sequences, and synonyms, and write reviewed descriptions back as
`COMMENT ON TABLE` / `COMMENT ON COLUMN` statements. This page walks through registering
a profile, deciding between **service name** (modern) and **SID** (legacy), and
applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx`). The `oracledb` driver (modern replacement for `cx_Oracle`) is included by default. AMX uses **thin mode** by default — no Oracle Instant Client install required.
- An Oracle 12c+ database reachable from the machine running AMX.
- A user with `CREATE SESSION` and read access to the catalog views (`SELECT_CATALOG_ROLE` or explicit grants on `ALL_TABLES`, `ALL_TAB_COLUMNS`, etc.) and `COMMENT ANY TABLE` on the schemas you intend to write back to. Read-only is enough for everything except `/apply`.
- An active LLM profile (or skip ahead with `/add-llm-profile`).

```sql
-- Minimal grants for read-only AMX use
CREATE USER amx_reader IDENTIFIED BY "********";
GRANT CREATE SESSION TO amx_reader;
GRANT SELECT_CATALOG_ROLE TO amx_reader;

-- Add COMMENT ANY TABLE for /apply (write-back)
GRANT COMMENT ANY TABLE TO amx_reader;
```

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add a database profile

```text
> /add-db-profile
```

Pick `oracle` from the backend menu:

```text
Select database backend (engine):
  ...
  oracle     Host/port user/password + service_name - Oracle DB; ALL_* catalogs
  ...
> oracle
```

### 3. Answer the connection prompts

```text
Database host (e.g. ora.example.com): ora-prod.eu-west-1.example.com
Port (e.g. 1521): 1521
Username (e.g. APP_USER): AMX_READER
Password: ••••••••
Service name (preferred for Oracle Cloud / RAC, e.g. XEPDB1) — leave blank to use SID instead:
  XEPDB1
```

Notes on each field:

- **Port** — defaults to `1521`. Validates digits.
- **Service name vs SID** — the wizard asks for service name first. If you leave it blank, you'll be prompted for an SID instead. **Always prefer service name** for modern deployments (Oracle Cloud Autonomous DB, RAC, multi-tenant CDB/PDB). SID is only correct for old single-instance databases.
- **Password** — stored in the OS keychain when one is available.

!!! tip "Service name vs SID — quick decision"
    - You're on **Oracle Cloud / Autonomous DB** → service name (the wallet's `tnsnames.ora` lists it as `…_high`, `…_medium`, `…_low`).
    - You're on **a multi-tenant CDB/PDB** (12c+) → service name (the PDB name).
    - You're on **RAC / Data Guard** → service name (RAC clients can't use SID safely).
    - You're on **a single-instance Oracle 11g** with no PDBs → SID is acceptable.

### 4. Activate and confirm

```text
> /use-db prod-ora
✓ Active DB profile → prod-ora [oracle] ora-prod.eu-west-1.example.com:1521/XEPDB1

> /connect
Testing prod-ora... ✓ connected (server: 19.21.0.0.0, mode: thin, latency: 41 ms)
```

`mode: thin` confirms AMX is talking to Oracle without an Instant Client install. If you
need thick mode (e.g. for Kerberos or older Oracle versions), `pip install oracledb` is
already enough — set `oracledb.init_oracle_client()` via the `AMX_ORACLE_LIB_DIR` env
var; see [Environment variables](../configuration/env-vars.md).

### 5. Inspect schemas and tables

```text
> /schemas
schema       objects   tables   views   matviews
SALES        21        16       2       3
CATALOG      7         7        0       0
APP_DATA     54        50       4       0

> /tables SALES
schema   name              kind    rows         comment?
SALES    CUSTOMER          TABLE   2,450,118    no
SALES    CUSTOMER_ADDRESS  TABLE   2,450,118    no
SALES    INVENTORY_DAILY   TABLE   45,318,234   yes
```

Oracle "schemas" are users — AMX shows the schemas the connecting user can see via
`ALL_TABLES`. If a schema is missing from this list, the user lacks `SELECT` on those
catalog rows.

### 6. Run and apply

```text
> /run SALES.CUSTOMER
[Profile] sampled scan on SALES.CUSTOMER ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 comment(s) to ora-prod.eu-west-1.example.com:1521/XEPDB1? [y/N]: y

COMMENT ON TABLE  SALES.CUSTOMER IS 'Master customer record …';
COMMENT ON COLUMN SALES.CUSTOMER.C_CUSTOMER_SK IS 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

Service-name (modern, recommended):

```yaml
db_profiles:
  prod-ora:
    backend: oracle
    host: ora-prod.eu-west-1.example.com
    port: 1521
    user: AMX_READER
    password: keyring://amx/prod-ora/password
    service_name: XEPDB1
    database: ""        # SID — leave blank when service_name is set
    profiling_mode: sampled
active_db_profile: prod-ora
```

SID (legacy single-instance):

```yaml
db_profiles:
  legacy-ora:
    backend: oracle
    host: ora-legacy.example.local
    port: 1521
    user: AMX_READER
    password: keyring://amx/legacy-ora/password
    service_name: ""    # leave blank to use SID
    database: XE        # the SID
```

## Verify

1. `> /connect` — server version, mode (thin / thick), and latency.
2. `> /db inspect` — counts of tables, views, materialized views, packages, procedures, triggers, sequences, synonyms, and UDTs. Materialized views and packages are first-class on Oracle.
3. `> amx doctor` — driver loaded, profile reachable, write-back grants confirmed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ORA-12541: TNS:no listener` | Wrong host or port (or listener stopped) | Confirm `host:port` against the DBA's `lsnrctl status` output |
| `ORA-12514: TNS:listener does not currently know of service requested` | Service name mismatch (typo, or PDB not open) | `lsnrctl services` lists what the listener knows about; for a PDB also confirm `ALTER PLUGGABLE DATABASE XEPDB1 OPEN;` has been run |
| `ORA-01017: invalid username/password; logon denied` | Bad password (or expired) | Re-set with `ALTER USER AMX_READER IDENTIFIED BY …;`. If the policy expired the password, also `PROFILE … LIMIT PASSWORD_LIFE_TIME UNLIMITED` |
| `ORA-00942: table or view does not exist` during `/run` | Connecting user lacks SELECT on the target schema's tables (catalog row missing) | `GRANT SELECT ON SALES.CUSTOMER TO AMX_READER;` (or grant `SELECT_CATALOG_ROLE` for blanket read) |
| `ORA-01031: insufficient privileges` mid-`/apply` | User lacks `COMMENT ANY TABLE` (or owner-level access) | `GRANT COMMENT ANY TABLE TO AMX_READER;` or run `/apply` as the schema owner |
| `DPY-3002: connection abandoned by server` mid-run | Long-running scan tripped Resource Manager limits | Set `profiling_mode: sampled` and reduce `profiling_sample_size`; talk to the DBA about a higher limit for the AMX session |

## What's next

- [Environment variables](../configuration/env-vars.md) — `AMX_ORACLE_LIB_DIR` for thick-mode / Kerberos use.
- [Profiling modes](../configuration/profiling-modes.md) — sampled is the safe default; `metadata` for inventory-only sweeps.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes and per-row error handling on `/apply`.
