# MySQL / MariaDB

Configure MySQL 8.0+ or MariaDB 10.5+ as an AMX backend to introspect tables, views,
procedures, functions, triggers, and scheduled events, and write reviewed descriptions
back as `ALTER TABLE … COMMENT` and column-level `MODIFY COLUMN … COMMENT` statements.
This page walks through registering a profile, granting the privileges AMX needs, and
applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `pymysql` and `cryptography` (for `caching_sha2_password`) drivers are included by default.
- A MySQL 8.0+ or MariaDB 10.5+ server reachable from the machine running AMX.
- A user with `SELECT` on every target schema (`information_schema` access is implicit) and `ALTER` on the schemas you intend to write back to. `PROCESS` is helpful for `SHOW FULL PROCESSLIST` diagnostics but not required.
- An active LLM profile (or skip ahead with `/add-llm-profile`).

```sql
-- Minimal grants for read-only AMX use
CREATE USER 'amx_reader'@'%' IDENTIFIED BY '••••••••';
GRANT SELECT ON sales.* TO 'amx_reader'@'%';

-- Add ALTER for /apply (write-back)
GRANT ALTER ON sales.* TO 'amx_reader'@'%';
FLUSH PRIVILEGES;
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

Pick `mysql` from the backend menu:

```text
Select database backend (engine):
  ...
  mysql      Host/port user/password - MySQL/MariaDB; ALTER TABLE COMMENT
  ...
> mysql
```

### 3. Answer the connection prompts

```text
Database host (e.g. db.example.com): db-prod.eu-west-1.rds.amazonaws.com
Port (e.g. 3306): 3306
Username (e.g. analyst): amx_reader
Password: ••••••••
Database name (optional — leave blank to pick at command time): sales
```

Notes on each field:

- **Port** — defaults to `3306`. The wizard validates digits only; non-numeric input re-prompts with `Port must be a number.`.
- **Username / password** — required. Password is stored in the OS keychain when one is available.
- **Database** — optional. With it filled, every command targets `sales` directly; without it, AMX shows the database picker at `/run` / `/sync` time.

!!! tip "MySQL vs MariaDB"
    AMX uses the same `pymysql` driver against both. The only behavior diffs that surface in AMX:
    
    - **Comment length** — MySQL truncates table comments at 2048 chars; MariaDB at 2048 chars; column comments at 1024 chars on both. AMX truncates LLM output to fit and warns when it does.
    - **Scheduled events** — listed under "Distinctive types" on both, but `/apply` only writes comments to tables and views.
    - **`caching_sha2_password`** — MySQL 8 default. AMX's bundled `cryptography` package handles it without extra config; MariaDB still uses `mysql_native_password` and works out of the box.

### 4. Activate and confirm

```text
> /use-db prod-mysql
✓ Active DB profile → prod-mysql [mysql] db-prod.eu-west-1.rds.amazonaws.com:3306/sales

> /connect
Testing prod-mysql... ✓ connected (server: 8.0.36-MySQL Community Server, latency: 22 ms)
```

### 5. Inspect schemas and tables

```text
> /schemas
schema     objects   tables   views
sales      18        16       2
catalog    7         7        0

> /tables sales
schema   name              kind    rows         comment?
sales    customer          TABLE   2,450,118    no
sales    customer_address  TABLE   2,450,118    no
sales    inventory         TABLE   45,318,234   yes
```

### 6. Run and apply

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 comment(s) to db-prod.eu-west-1.rds.amazonaws.com/sales? [y/N]: y

ALTER TABLE sales.customer COMMENT = 'Master customer record …';
ALTER TABLE sales.customer
  MODIFY COLUMN c_customer_sk INT NOT NULL COMMENT 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

Column comments require `MODIFY COLUMN` — AMX preserves the existing column type / NULL /
default and only updates the `COMMENT` clause. Per-column failures (e.g. type mismatch
between observed schema and stored DDL) are reported individually; the rest still apply.

## Sample config

```yaml
db_profiles:
  prod-mysql:
    backend: mysql
    host: db-prod.eu-west-1.rds.amazonaws.com
    port: 3306
    user: amx_reader
    password: keyring://amx/prod-mysql/password
    database: sales
    profiling_mode: sampled
    profiling_sample_size: 5000
active_db_profile: prod-mysql
```

## Verify

1. `> /connect` — server version + round-trip latency.
2. `> /db inspect` — counts of tables, views, procedures, functions, triggers, and events. Distinctive MySQL/MariaDB object types (events, partitions, storage engines) are listed in the inspect output.
3. `> /doctor` — driver loaded, profile reachable, comment write-back privilege confirmed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pymysql.err.OperationalError: (2003, "Can't connect to MySQL server …")` | Server bind address is `localhost`/`127.0.0.1`, or the firewall blocks the client | Set `bind-address = 0.0.0.0` in `my.cnf`, restart, and confirm the security-group / iptables rule |
| `(1045, "Access denied for user 'amx_reader'@'10.0.0.42' (using password: YES)")` | Wrong password or the user doesn't exist for that host | Re-create the user with `'%'` host, or with the specific client IP. `FLUSH PRIVILEGES;` after grants |
| `(1142, "ALTER command denied to user")` mid-`/apply` | User can SELECT but lacks ALTER on the schema | `GRANT ALTER ON sales.* TO 'amx_reader'@'%';` |
| `(2059, "Authentication plugin 'caching_sha2_password' cannot be loaded")` | Outdated client without the plugin (very old `cryptography`) | `pip install -U cryptography pymysql` and try again |
| `(1366, "Incorrect string value: '\\xF0\\x9F…' for column 'comment'")` | The LLM output contains 4-byte UTF-8 (emoji); the column charset is `utf8` not `utf8mb4` | `ALTER TABLE … CONVERT TO CHARACTER SET utf8mb4;` or set the LLM profile to plain ASCII |

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — sampled mode is the default for MySQL; `full` is fine for tables under a few million rows.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes and how `/apply` handles per-row failures.
- [Shared history store](../collaboration/shared-history-store.md) — store the audit trail in the same MySQL instance for team workflows.
