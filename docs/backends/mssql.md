# SQL Server

Configure Microsoft SQL Server (2017+) or Azure SQL as an AMX backend to introspect
tables, views, procedures, functions, triggers, sequences, and synonyms, and write
reviewed descriptions back as `sp_addextendedproperty` / `sp_updateextendedproperty`
calls. This page walks through installing the ODBC driver per OS, registering a profile,
and applying your first batch of generated descriptions.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `pyodbc` driver is included by default.
- **ODBC Driver 18 for SQL Server** installed at the OS level (driver 17 also works but is end-of-mainstream-support; driver 18 is the default the wizard suggests).
- A SQL Server 2017+ or Azure SQL database reachable from the machine running AMX.
- A login mapped to a user with `SELECT` on every target schema and `ALTER` on the schemas you intend to write back to. AMX uses extended properties, which require schema-level `ALTER`.
- An active LLM profile (or skip ahead with `/add-llm-profile`).

### Install ODBC Driver 18 per OS

=== "macOS (Homebrew)"

    ```bash
    brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
    brew update
    HOMEBREW_ACCEPT_EULA=Y brew install msodbcsql18 mssql-tools18
    odbcinst -j   # confirm /usr/local/etc/odbcinst.ini knows the driver
    ```

=== "Ubuntu / Debian"

    ```bash
    curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc
    curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list
    sudo apt-get update
    sudo ACCEPT_EULA=Y apt-get install -y msodbcsql18
    odbcinst -j
    ```

=== "Windows"

    Download from
    [docs.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server)
    and run the installer. AMX picks up the driver automatically — no extra config.

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add a database profile

```text
> /add-db-profile
```

Pick `mssql` from the backend menu:

```text
Select database backend (engine):
  ...
  mssql      Host/port user/password + ODBC driver - SQL Server / Azure SQL
  ...
> mssql
```

### 3. Answer the connection prompts

```text
Database host (e.g. mssql.example.com): mssql-prod.example.com
Port (e.g. 1433): 1433
Username (e.g. sa): amx_reader
Password: ••••••••
Database name (optional — leave blank to pick at command time): sales
ODBC driver name (default: 'ODBC Driver 18 for SQL Server'):
Encrypt the connection? (set False only for legacy on-prem servers without TLS) [Y/n]: y
Trust the server certificate? (use True only with self-signed certs) [y/N]: n
```

Notes on each field:

- **Port** — `1433` default. Validates digits.
- **Database** — optional. With it filled, every command targets `sales`; without it, AMX shows the database picker at `/run` time.
- **ODBC driver name** — leave blank to accept the default `ODBC Driver 18 for SQL Server`. If you have only driver 17 installed, type `ODBC Driver 17 for SQL Server` here.
- **Encrypt** — defaults to `True` (driver 18's default). Only set `False` for old on-prem servers that don't speak TLS — modern servers and Azure SQL require encryption.
- **Trust the server certificate** — defaults to `False`. Set `True` only against a self-signed cert in dev. Azure SQL and modern on-prem with a CA-signed cert should leave this off.

!!! warning "Azure SQL — `Encrypt = True; TrustServerCertificate = False`"
    Azure SQL refuses unencrypted connections and uses a CA-signed cert. The defaults the wizard suggests are correct. Setting `TrustServerCertificate = True` will work but defeats the cert check — only do it as a debug step.

### 4. Activate and confirm

```text
> /use-db prod-mssql
✓ Active DB profile → prod-mssql [mssql] mssql-prod.example.com:1433/sales

> /connect
Testing prod-mssql... ✓ connected (server: 16.00.4115.5 (SQL Server 2022), driver: ODBC Driver 18, latency: 28 ms)
```

### 5. Inspect schemas and tables

```text
> /schemas
schema     objects   tables   views   procs
dbo        24        18       6       12
sales      18        16       2       4

> /tables sales
schema   name              kind    rows         comment?
sales    customer          TABLE   2,450,118    no
sales    customer_address  TABLE   2,450,118    no
sales    inventory         TABLE   45,318,234   yes
```

The `comment?` column reflects whether the object has the `MS_Description` extended
property set; AMX writes to that property name by default.

### 6. Run and apply

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 description(s) to mssql-prod.example.com/sales? [y/N]: y

EXEC sp_addextendedproperty
  @name = N'MS_Description', @value = N'Master customer record …',
  @level0type = N'SCHEMA', @level0name = N'sales',
  @level1type = N'TABLE',  @level1name = N'customer';

EXEC sp_addextendedproperty
  @name = N'MS_Description', @value = N'Surrogate key …',
  @level0type = N'SCHEMA', @level0name = N'sales',
  @level1type = N'TABLE',  @level1name = N'customer',
  @level2type = N'COLUMN', @level2name = N'c_customer_sk';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

When the property already exists, AMX automatically calls `sp_updateextendedproperty`
instead of `sp_addextendedproperty` so re-apply doesn't fail with "property already
exists".

## Sample config

```yaml
db_profiles:
  prod-mssql:
    backend: mssql
    host: mssql-prod.example.com
    port: 1433
    user: amx_reader
    password: keyring://amx/prod-mssql/password
    database: sales
    driver: "ODBC Driver 18 for SQL Server"
    encrypt: true
    trust_server_certificate: false
    profiling_mode: sampled
active_db_profile: prod-mssql
```

## Verify

1. `> /connect` — server version + driver + latency. The driver line is essential when troubleshooting "driver not found" errors.
2. `> /db inspect` — counts of tables, views, procedures (FN/TF/IF), triggers, sequences, synonyms, partitions.
3. `> amx doctor` — confirms `pyodbc` is loaded, the chosen ODBC driver is registered, and the profile reaches the server.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pyodbc.InterfaceError: ('IM002', '[IM002] [unixODBC][Driver Manager]Data source name not found and no default driver specified')` | ODBC Driver 18 not installed at the OS level | Install per the OS tabs above; confirm with `odbcinst -q -d` |
| `('08001', '[08001] [Microsoft][ODBC Driver 18 for SQL Server]SSL Provider: certificate verify failed')` | Self-signed cert and `trust_server_certificate: false` | Pin a CA bundle (preferred) or set `trust_server_certificate: true` only as a debug step |
| `('28000', "Login failed for user 'amx_reader'")` | Wrong password OR Windows-auth-only login | Reset the SQL login; or switch to Windows auth via `Trusted_Connection=yes` in a custom connection string |
| `('42000', "ALTER permission denied")` mid-`/apply` | User lacks `ALTER` on the schema | `GRANT ALTER ON SCHEMA::sales TO amx_reader;` |
| `[Microsoft][ODBC Driver 18 ...] Encrypt parameter set to "true" but no encryption support` | Old on-prem SQL Server without TLS | Set `encrypt: false` in the YAML — only acceptable for isolated legacy servers |
| Comments don't appear in SSMS object explorer | SSMS reads `MS_Description`; AMX writes to `MS_Description` by default — no diff. SSMS just caches the schema | Refresh the schema in SSMS (F5) or reconnect |

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — `sampled` (TABLESAMPLE) is the default; `full` is fine for tables under a few million rows.
- [Run & Apply](../cli/run-and-apply.md) — review wizard, keystrokes, and per-row error handling on `/apply`.
- [Configuration: TLS and proxies](../configuration/tls-and-proxies.md) — for Azure SQL behind a corporate proxy.
