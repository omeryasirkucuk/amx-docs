# ClickHouse

Configure ClickHouse (self-managed or ClickHouse Cloud) as an AMX backend to introspect
tables, materialized views, dictionaries, and UDFs, and write reviewed descriptions back
as `ALTER TABLE … MODIFY COMMENT` and column-level `MODIFY COLUMN … COMMENT` statements.
This page walks through registering a profile, picking the right port for HTTP vs HTTPS,
and applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx-cli`). The `clickhouse-connect` and `clickhouse-sqlalchemy` drivers are included by default.
- A ClickHouse 22.8+ server reachable from the machine running AMX.
- A user with `SELECT` on the target databases (`information_schema` access is implicit) and `ALTER` on the tables you intend to write back to. ClickHouse comments are part of the table DDL, so write-back requires `ALTER`.
- An active LLM profile (or skip ahead with `/add-llm-profile`).

```sql
-- Minimal grants for read-only AMX use
CREATE USER amx_reader IDENTIFIED WITH sha256_password BY '••••••••';
GRANT SELECT ON sales.* TO amx_reader;

-- Add ALTER for /apply (write-back)
GRANT ALTER ON sales.* TO amx_reader;
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

Pick `clickhouse` from the backend menu:

```text
Select database backend (engine):
  ...
  clickhouse Host/port user/password - ClickHouse; system.* catalogs, MergeTree engines
  ...
> clickhouse
```

### 3. Answer the connection prompts

```text
ClickHouse host (e.g. ch.example.com): ch-prod.eu-west-1.example.com
Use HTTPS? (8443 / cloud) — answer No for plain HTTP (8123 / on-prem) [y/N]: y
Port (default 8443):
Username (default: 'default'): amx_reader
Password (blank for the default 'no password' user): ••••••••
Database (e.g. analytics — leave blank to pick at command time): sales
```

Notes on each field:

- **Use HTTPS?** — answer `y` for ClickHouse Cloud and any self-managed deployment using a TLS reverse-proxy. Answer `n` for plain on-prem. The default port follows automatically: `8443` for HTTPS, `8123` for HTTP.
- **Port** — defaults to the value derived from the HTTPS choice. Validates digits.
- **Username** — defaults to `default` (ClickHouse's built-in admin). Use a dedicated read-only user for production.
- **Password** — leave blank only if the ClickHouse user has no password (the built-in `default` user does, by default, in 21.8+).
- **Database** — optional. With it filled, every command targets `sales`; without it, AMX shows the database picker at `/run` time.

### 4. Activate and confirm

```text
> /use-db prod-ch
✓ Active DB profile → prod-ch [clickhouse] https://ch-prod.eu-west-1.example.com:8443/sales

> /connect
Testing prod-ch... ✓ connected (server: 24.3.1.1, latency: 64 ms)
```

### 5. Inspect databases and tables

```text
> /schemas
database     objects   tables   matviews   dictionaries
sales        21        16       3          2
events       45        45       0          0
system       100+      100+     0          0  (read-only)

> /tables sales
database  name              kind            engine           rows         comment?
sales     customer          TABLE           ReplicatedMergeTree   2,450,118    no
sales     customer_address  TABLE           ReplicatedMergeTree   2,450,118    no
sales     order_summary_mv  MATERIALIZED    AggregatingMergeTree  18,234       yes
```

The `engine` column matters — AMX uses it to skip distributed-engine tables on `/apply`
(comment write-back must hit the underlying replicated table, not the distributed shard
front).

### 6. Run and apply

```text
> /run sales.customer
[Profile] SAMPLE clause on sales.customer ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 13, medium: 4, low: 1)

> /apply
Write 18 comment(s) to https://ch-prod.eu-west-1.example.com:8443/sales? [y/N]: y

ALTER TABLE sales.customer
  MODIFY COMMENT 'Master customer record …';

ALTER TABLE sales.customer
  MODIFY COLUMN c_customer_sk UInt64 COMMENT 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

```yaml
db_profiles:
  prod-ch:
    backend: clickhouse
    host: ch-prod.eu-west-1.example.com
    port: 8443
    secure: true              # → HTTPS
    user: amx_reader
    password: keyring://amx/prod-ch/password
    database: sales
    profiling_mode: sampled
    profiling_sample_size: 5000
active_db_profile: prod-ch
```

For ClickHouse Cloud, the host has the form `<service-id>.<region>.aws.clickhouse.cloud`
and the port is `8443`.

## Verify

1. `> /connect` — server version + latency. ClickHouse usually returns under ~100 ms; sustained higher values often mean the load balancer is in a different region from the client.
2. `> /db inspect` — counts of tables, materialized views, dictionaries, and UDFs. Engine breakdown (MergeTree variants) is included.
3. `> /doctor` — driver loaded, profile reachable, write-back grants confirmed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `clickhouse_connect.driver.exceptions.NetworkError: HTTPSConnectionPool: Max retries exceeded` | Wrong port for the HTTPS choice (e.g. HTTPS=true but port=8123) | Re-run `/add-db-profile`; pick HTTPS=yes → port 8443, HTTPS=no → port 8123 |
| `Code: 516. DB::Exception: amx_reader: Authentication failed` | Wrong password OR user has `IDENTIFIED WITH ldap` and AMX can't reach LDAP | Reset the password OR switch the user back to `sha256_password` for AMX use |
| `Code: 497. DB::Exception: Not enough privileges. To execute this query, it's necessary to have the grant SELECT on …` | User lacks `SELECT` on the target schema | `GRANT SELECT ON sales.* TO amx_reader;` |
| `Code: 60. DB::Exception: Table sales.customer doesn't exist on cluster …` mid-`/apply` | Comment was queued for a Distributed table; AMX should have skipped it | Re-run `/apply` (AMX now skips the distributed front and writes to the underlying replicated tables) |
| `external_history_store_unsupported` from `/history-store enable` | ClickHouse doesn't support `UPDATE` semantics needed by the shared history store | Use a different backend (PostgreSQL is the recommended history store host) — see [Shared history store](../collaboration/shared-history-store.md) |
| `Code: 233. DB::Exception: Memory limit (for query) exceeded` | Full-mode profiling on a wide MergeTree table | Switch to `profiling_mode: sampled` or shrink `profiling_sample_size` |

!!! warning "Shared history store on ClickHouse — unsupported"
    The shared history store needs `UPDATE` against the audit table to mark runs as
    applied. ClickHouse doesn't support row-level UPDATE in MergeTree without
    `ALTER … UPDATE` (which is async and not safe for transactional intent), so AMX
    refuses to enable history-store on a ClickHouse profile. Host the history store on
    PostgreSQL or any other supported backend; the ClickHouse profile remains the data
    source — only the audit table moves elsewhere.

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — ClickHouse uses the `SAMPLE` clause for sampled mode; `metadata` mode hits `system.*` only.
- [Shared history store](../collaboration/shared-history-store.md) — host the audit table on PostgreSQL while keeping ClickHouse as the data source.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes and per-row error handling on `/apply`.
