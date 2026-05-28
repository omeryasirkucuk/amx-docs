# Snowflake

Configure Snowflake as an AMX backend to introspect tables, views, procedures, tasks,
stages, shares, and external tables, and write reviewed descriptions back as
`COMMENT ON …` statements. This page walks through registering a Snowflake profile,
picking the right role and warehouse, choosing a profiling mode that won't surprise your
billing, and applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `snowflake-connector-python` driver is installed on first use (needs network); only DuckDB ships with the base install.
- A Snowflake account with reachable network policy (typical: AMX runs from a workstation or CI runner; whitelist that egress IP).
- A role that can `USAGE` on the database, `USAGE` on every target schema, `SELECT` on the target tables/views, and `MODIFY` on the schema if you intend to write back comments.
- A warehouse the role can `USE`. Even tiny X-Small warehouses are enough for `metadata` and `sampled` profiling.
- An active LLM profile (or skip ahead and add one with `/add-llm-profile`).

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add a database profile

```text
> /add-db-profile
```

Pick `snowflake` from the backend menu:

```text
Select database backend (engine):
  postgresql   ...
  snowflake    Account, warehouse, role - Snowflake COMMENT
  databricks   ...
  ...
> snowflake
```

### 3. Answer the connection prompts

```text
Snowflake account identifier (e.g. xy12345.us-east-1): xy12345.eu-west-1
Username (e.g. ANALYST): AMX_READER
Password: ••••••••
Database name (optional, e.g. ANALYTICS — leave blank to pick at command time):
  ANALYTICS
Warehouse (optional, e.g. COMPUTE_WH): WH_AMX_XS
Role (optional, e.g. ANALYST): AMX_READER_ROLE
```

Notes on each field:

- **Account identifier** — the same string you'd put in the JDBC URL (`<orgname>-<account>` or the legacy `<account>.<region>` form). No protocol, no `.snowflakecomputing.com` suffix.
- **Username / password** — required. Password lands in the OS keychain when one is available.
- **Database** — optional since AMX 0.11. Leave blank to be presented with the database picker at `/run` / `/sync` time.
- **Warehouse** — optional. If you leave it blank, AMX uses the role's default warehouse; if there is no default, the first SQL call fails with `No active warehouse selected`. For predictable cost, always set a small dedicated warehouse here.
- **Role** — optional. If you leave it blank, AMX uses the user's default role. Use the role picker `/use-db-role` later if you want to switch without re-adding the profile.

!!! warning "Auth choice — password vs key-pair vs OAuth"
    The wizard registers password auth. If your account requires key-pair auth or SSO, finish the wizard with any placeholder password and then edit `~/.amx/config.yml`:
    
    - **Key-pair**: replace `password:` with `private_key_path: /home/me/.snowflake/rsa_key.p8` and (if needed) `private_key_passphrase: keyring://amx/snowflake/passphrase`. The connector picks the file up automatically.
    - **OAuth / external browser**: replace `password:` with `authenticator: externalbrowser`. AMX will pop the browser flow on the first connection.

### 4. Activate and confirm

```text
> /use-db prod-sf
✓ Active DB profile → prod-sf [snowflake] xy12345.eu-west-1/ANALYTICS · WH_AMX_XS · AMX_READER_ROLE

> /connect
Testing prod-sf... ✓ connected (server: 8.34.1, role: AMX_READER_ROLE, warehouse: WH_AMX_XS)
```

### 5. Inspect schemas and tables

```text
> /schemas
schema       objects   tables   views
PUBLIC       12        9        3
SALES        18        16       2
RAW          120       120      0

> /tables SALES
schema   name              kind    rows           comment?
SALES    CUSTOMER          TABLE   2,450,118      no
SALES    CUSTOMER_ADDRESS  TABLE   2,450,118      no
SALES    INVENTORY_DAILY   TABLE   45,318,234     yes
...
```

### 6. Pick a profiling mode that fits your warehouse cost

```text
> /profiling
Current mode: full
  full      — read every row to compute exact null/distinct stats
  sampled   — TABLESAMPLE BERNOULLI(N) — fast, cheap, good enough for description drafting
  metadata  — only read SHOW / INFORMATION_SCHEMA — no row scans at all

> /profiling sampled
✓ Active mode → sampled (5000 rows per table)
```

For warehouse-cost-sensitive workflows the rule of thumb is:

- **`metadata`** — drafting descriptions across thousands of tables. Zero row scans.
- **`sampled`** — most one-off `/run` calls. Wakes the warehouse for a few seconds.
- **`full`** — only when you need exact distinct counts (e.g. validating a uniqueness claim before promoting a column to a key). Wakes the warehouse for as long as the scan takes.

### 7. Run and apply

```text
> /run SALES.CUSTOMER
[Profile] TABLESAMPLE BERNOULLI(5000) on SALES.CUSTOMER ... ok (1.4 s)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 comment(s) to xy12345.eu-west-1/ANALYTICS? [y/N]: y

COMMENT ON TABLE  ANALYTICS.SALES.CUSTOMER IS 'Master customer record …';
COMMENT ON COLUMN ANALYTICS.SALES.CUSTOMER.C_CUSTOMER_SK IS 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

The wizard above writes this block to `~/.amx/config.yml`:

```yaml
db_profiles:
  prod-sf:
    backend: snowflake
    account: xy12345.eu-west-1
    user: AMX_READER
    password: keyring://amx/prod-sf/password
    database: ANALYTICS
    warehouse: WH_AMX_XS
    role: AMX_READER_ROLE
    profiling_mode: sampled
    profiling_sample_size: 5000
active_db_profile: prod-sf
```

For key-pair auth swap `password:` for `private_key_path:`. For SSO, set
`authenticator: externalbrowser` and remove `password:`.

## Verify

1. `> /connect` — reports server version, active role, and active warehouse. Anything missing here is the most common reason `/run` later fails.
2. `> /inspect` — counts of tables / views / procedures / tasks / stages. Snowflake-specific object types (tasks, stages, shares) are listed under "Distinctive types".
3. `> /doctor` — verifies the Snowflake driver is installed, the profile is active, and the connection round-trips.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `250001 (08001): Failed to connect to DB. … 404 Not Found` | The account identifier is wrong (extra suffix, missing region) | Re-run `/add-db-profile` and use the bare `<orgname>-<account>` or `<account>.<region>` form — no `.snowflakecomputing.com` |
| `No active warehouse selected in the current session` | Profile didn't set a warehouse and the role has no default | Edit `~/.amx/config.yml`, set `warehouse: WH_AMX_XS`, restart AMX |
| `390100 (08004): Incorrect username or password was specified.` | Password expired or MFA is required | Rotate the password OR switch to key-pair / SSO (see auth note above) |
| `/run` is fast for the first table then suddenly slow | Warehouse auto-suspended between tables and is resuming | Use a larger warehouse OR set `profiling_mode: metadata` for the first sweep, then switch to `sampled` for the subset you want descriptions for |
| `001003 (42000): SQL compilation error: Object 'X' does not exist or not authorized` | Role lacks `USAGE` on the schema or `SELECT` on the table | Ask the security admin to grant the missing privileges; verify with `SHOW GRANTS TO ROLE AMX_READER_ROLE` |
