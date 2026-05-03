# Amazon Redshift

Configure Amazon Redshift (Provisioned or Serverless) as an AMX backend to introspect
tables, views, materialized views, procedures, UDFs, datashares, and external tables
(Spectrum), and write reviewed descriptions back as `COMMENT ON …` statements. This page
walks through registering a profile (with or without IAM auth), picking a profiling mode
that fits the cluster, and applying your first batch of generated comments.

## Prerequisites

- AMX installed (`pip install amx`). The `redshift_connector` and `sqlalchemy-redshift` drivers are included by default.
- A Redshift cluster (Provisioned) or workgroup (Serverless), reachable from the machine running AMX.
- A user (or IAM principal mapped to a Redshift user) with `USAGE` on the target schema, `SELECT` on its tables, and `COMMENT` on the objects you intend to write back to. `pg_user` style ownership transfers are not required — just `COMMENT` privileges.
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

Pick `redshift` from the backend menu:

```text
Select database backend (engine):
  ...
  redshift   Host/port user/password - Amazon Redshift; PG-compatible + Spectrum
  ...
> redshift
```

### 3. Answer the connection prompts

```text
Cluster endpoint (e.g. my-cluster.xxx.eu-west-1.redshift.amazonaws.com):
  prod-cluster.abc123def456.eu-west-1.redshift.amazonaws.com
Port (e.g. 5439): 5439
Username (e.g. admin): amx_reader
Password: ••••••••
Database name (e.g. dev — leave blank to pick at command time): analytics
Cluster identifier (optional, only needed for IAM auth):
```

Notes on each field:

- **Cluster endpoint** — for **Provisioned**, the full `…redshift.amazonaws.com` hostname. For **Serverless**, the workgroup endpoint (`<workgroup>.<account-id>.<region>.redshift-serverless.amazonaws.com`). Both work.
- **Port** — `5439` default. Validates digits.
- **Database** — defaults to `dev` on a freshly-created cluster. Leave blank to use the database picker at command time.
- **Cluster identifier** — only required if you use IAM-based auth (`GetClusterCredentials`). For password auth, leave it blank.

!!! tip "Provisioned vs Serverless — and IAM vs password"
    - **Password auth (default)** — works on both Provisioned and Serverless. Set host, port, user, password and you're done.
    - **IAM auth (Provisioned only)** — fill in `cluster_identifier`, set `password: ""` in the YAML, then run AMX with `AWS_PROFILE=…` (or any standard AWS credential source). AMX calls `GetClusterCredentials` to mint a temporary password.
    - **IAM auth (Serverless)** — set `password: ""` and run with `AWS_PROFILE=…`; AMX calls `GetCredentials` against the workgroup's IAM endpoint.
    
    Use IAM whenever you can — passwords stored in the YAML are an audit liability.

### 4. Activate and confirm

```text
> /use-db prod-rs
✓ Active DB profile → prod-rs [redshift] prod-cluster.abc123def456.eu-west-1.redshift.amazonaws.com:5439/analytics

> /connect
Testing prod-rs... ✓ connected (server: PostgreSQL 8.0.2 on i686-pc-linux-gnu, redshift: PostgreSQL 8.0.2 on i686-pc-linux-gnu, latency: 89 ms)
```

The PG-8.0.2 string is Redshift's wire-protocol identity; the AMX `/connect` line shows
both that and the actual Redshift release info.

### 5. Inspect schemas and tables

```text
> /schemas
schema             objects   tables   views   matviews   external?
public             8         8        0       0          no
sales              19        16       2       1          no
spectrum_curated   0         0        0       0          yes (datashare)
```

External / datashare schemas are listed; AMX skips comment write-back on them with
`external_schema_readonly` rather than emitting a SQL that would fail.

### 6. Run and apply

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 comment(s) to prod-cluster.abc123def456.eu-west-1.redshift.amazonaws.com/analytics? [y/N]: y

COMMENT ON TABLE  sales.customer IS 'Master customer record …';
COMMENT ON COLUMN sales.customer.c_customer_sk IS 'Surrogate key …';
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

Password auth:

```yaml
db_profiles:
  prod-rs:
    backend: redshift
    host: prod-cluster.abc123def456.eu-west-1.redshift.amazonaws.com
    port: 5439
    user: amx_reader
    password: keyring://amx/prod-rs/password
    database: analytics
    profiling_mode: sampled
active_db_profile: prod-rs
```

IAM auth (Provisioned):

```yaml
db_profiles:
  prod-rs-iam:
    backend: redshift
    host: prod-cluster.abc123def456.eu-west-1.redshift.amazonaws.com
    port: 5439
    user: amx_reader               # mapped to your IAM identity
    password: ""                   # blank → AMX uses GetClusterCredentials
    database: analytics
    cluster_identifier: prod-cluster
```

Then run AMX with the AWS credentials that have `redshift:GetClusterCredentials` for the
cluster.

## Verify

1. `> /connect` — server version + latency. Latency over a couple of seconds usually means the leader node is busy or your client IP is going through a NAT gateway over a Direct Connect link.
2. `> /db inspect` — table / view / matview counts plus distinctive types (datashares, external tables). Spectrum schemas are listed but flagged as read-only.
3. `> amx doctor` — confirms drivers loaded, profile reachable, and (for IAM auth) that AWS credentials resolve.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redshift_connector.OperationalError: connection failed: timeout expired` | Security group blocks the AMX client IP | Open inbound 5439 from the client IP/CIDR; for VPC-only clusters, AMX must run inside the VPC or via VPN |
| `FATAL:  password authentication failed for user "amx_reader"` | Password rotated, or trying password auth against an IAM-only user | Reset the password as the cluster admin; or switch to IAM auth (cluster_identifier + blank password) |
| `botocore.exceptions.NoCredentialsError: Unable to locate credentials` | IAM auth chosen but no AWS credential source | `aws configure`, set `AWS_PROFILE`, or run on an EC2/ECS task with an instance role |
| `permission denied for relation customer` during `/run` | User lacks `SELECT` (datashare permissions are different from local grants) | `GRANT SELECT ON ALL TABLES IN SCHEMA sales TO amx_reader;` (and `USAGE ON SCHEMA sales`) |
| `external_schema_readonly` on `/apply` | Target schema is a Spectrum / datashare schema | Comment write-back is unsupported on external schemas — write to the source instead |
| `Disk full` mid-`/run` with `profiling_mode: full` | Full scan of a wide table created a sort spill | Switch to `profiling_mode: sampled` or shrink `profiling_sample_size` |

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — `sampled` is the recommended default for Redshift; `full` only for tables you'd happily run a `SELECT *` against.
- [Configuration: env vars](../configuration/env-vars.md) — `AWS_PROFILE`, `AWS_REGION`, and the IAM credential resolution order AMX inherits from boto3.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes and per-row error handling on `/apply`.
