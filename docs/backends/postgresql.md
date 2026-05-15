# PostgreSQL

PostgreSQL is the reference adapter for AMX: AMX introspects the catalog, reads existing
`COMMENT ON` text, samples data subject to the active profiling mode, and writes reviewed
descriptions back as standard `COMMENT ON TABLE` / `COMMENT ON COLUMN` statements. This
page walks you through registering a PostgreSQL profile, testing the connection, and
applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `psycopg[binary]` driver is included by default — no extra extras required.
- A PostgreSQL 12+ server reachable from the machine running AMX.
- A database role with `CONNECT` on the database, `USAGE` on every target schema, `SELECT` on every target table, and `COMMENT` on the objects you intend to write back to. Read-only is enough for everything except `/apply`.
- An active LLM profile (or skip ahead and add one with `/add-llm-profile`).

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

You land in the interactive shell. Every command that follows is typed at the `>` prompt.

### 2. Add a database profile

```text
> /add-db-profile
```

The wizard asks for a profile name (e.g. `prod-pg`), then walks you through the backend picker. Pick `postgresql`:

```text
Select database backend (engine):
  postgresql   Host/port user/password - COMMENT ON metadata
  snowflake    Account, warehouse, role - Snowflake COMMENT
  databricks   SQL warehouse HTTP path + token - Unity Catalog
  ...
> postgresql
```

### 3. Answer the connection prompts

The wizard prompts in this exact order:

```text
Database host (e.g. db.example.com): db-prod.eu-west-1.rds.amazonaws.com
Port (e.g. 5432): 5432
Username (e.g. amx): amx_reader
Password: ••••••••
Database name (optional, e.g. postgres — leave blank to pick at command time):
  analytics
```

Notes on each field:

- **Host / port** — required, and the port is validated as digits. If you mistype, you'll see `Port must be a number.` and the prompt re-asks.
- **Username / password** — required. The password is stored in the OS keychain when one is available; otherwise it falls back to the YAML file with file-mode `0600`.
- **Database** — optional since AMX 0.11. Leave it blank to be presented with a server-side picker every time you run `/connect`, `/run`, or `/sync`. Fill it in for single-database workflows so commands don't pause to ask.

!!! warning "Connection test failed?"
    AMX runs a real `SELECT 1` round-trip after the wizard finishes. If it fails, the most common causes are: the `pg_hba.conf` rule blocks your client IP, the role lacks `CONNECT` on the chosen database, or you're behind a corporate proxy that needs a CA bundle. See [TLS and proxies](../configuration/tls-and-proxies.md) for the recovery path.

### 4. Activate the profile and confirm

```text
> /use-db prod-pg
✓ Active DB profile → prod-pg [postgresql] db-prod.eu-west-1.rds.amazonaws.com:5432/analytics

> /connect
Testing prod-pg... ✓ connected (server: PostgreSQL 15.4, latency: 38 ms)
```

### 5. Inspect the schema and pick a target

```text
> /schemas
schema      objects   tables   views
public      24        18       6
sales       17        17       0
catalog     5         5        0

> /tables sales
schema   name              kind    rows         comment?
sales    customer          TABLE   2,450,118    no
sales    customer_address  TABLE   2,450,118    no
sales    inventory         TABLE   45,318,234   yes
...
```

`comment?` shows which objects already have a `COMMENT ON` value — those will land in the
review queue with the existing text pre-filled so the LLM can suggest improvements.

### 6. Run the agents

```text
> /run sales.customer
[Profile] sampling 5,000 rows from sales.customer ... ok
[RAG]     no document profile active — skipping
[Code]    no code profile active — skipping
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)
```

Confidence buckets are derived from token logprobs against the thresholds you set in
`/add-llm-profile` (defaults: high ≥ 0.85, medium ≥ 0.50). Review each suggestion, edit
inline if needed, then continue.

### 7. Apply with `COMMENT ON`

```text
> /apply
Write 18 comment(s) to db-prod.eu-west-1.rds.amazonaws.com/analytics? [y/N]: y

COMMENT ON TABLE  sales.customer IS 'Master customer record …';
COMMENT ON COLUMN sales.customer.c_customer_sk IS 'Surrogate key …';
COMMENT ON COLUMN sales.customer.c_first_name  IS 'Given name …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

Each suggestion runs as its own statement so the `/history` audit shows exactly which rows
landed and which (if any) failed. Errors don't roll the batch back — they're surfaced at
the end and re-attempted only if you re-run `/apply`.

## Sample config

The wizard above writes this block to `~/.amx/config.yml`:

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    host: db-prod.eu-west-1.rds.amazonaws.com
    port: 5432
    user: amx_reader
    password: keyring://amx/prod-pg/password
    database: analytics
    profiling_mode: sampled        # full | sampled | metadata
    profiling_sample_size: 5000
active_db_profile: prod-pg
```

Drop `database:` to defer the choice to command time. Keep `profiling_mode: metadata` for
warehouse-cost-sensitive scans (no row scans at all).

## Verify

1. `> /connect` — reports server version + round-trip latency. Anything beyond a couple of seconds is usually a DNS or TLS handshake delay.
2. `> /db inspect` — server-side counts (databases, schemas, tables, views, materialized views) plus which `COMMENT ON` rows already have text.
3. `> /doctor --skip-network` then re-run without the flag — confirms drivers loaded and the active profile reaches the server.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `psycopg.OperationalError: connection to server … failed: SSL connection is required` | Server requires TLS but the wizard didn't enable it | Set `PGSSLMODE=require` in your env, or configure a CA bundle: see [TLS and proxies](../configuration/tls-and-proxies.md) |
| `permission denied for schema sales` during `/run` | Role can `CONNECT` but lacks `USAGE` on the schema | `GRANT USAGE ON SCHEMA sales TO amx_reader;` (and `SELECT` on its tables) |
| `/apply` writes 0 of N comments, all rows say `ERROR: must be owner` | Role lacks `COMMENT` privilege | `GRANT ALL ON TABLE sales.customer TO amx_reader;` or run `/apply` as the owning role |
| `Port must be a number.` repeats | Pasted a `host:port` string into the port field | Re-run `/add-db-profile` and split host and port across the two prompts |
| `psycopg.errors.AdminShutdown` mid-run | RDS / managed PG idle-timed-out the session during a long sample | Set `profiling_mode: sampled` (default 5,000 rows) or shrink `profiling_sample_size` |
