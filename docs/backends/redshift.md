# Amazon Redshift

## Install

```bash
pip install "amx[redshift]"
```

Drivers: `redshift_connector`, `sqlalchemy-redshift`.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `host` | yes | Cluster endpoint |
| `port` | no | Defaults to `5439` |
| `database` | yes | |
| `user` | yes | |
| `password` | yes | Stored in OS keychain when available |
| `iam` | no | `true` to use IAM auth via the AWS profile chain |
| `cluster_identifier` | conditional | Required when `iam: true` |
| `region` | conditional | Required when `iam: true` |

For AWS Secrets Manager-backed credentials, point the AMX Redshift profile at a temporary
copy of the username/password — the Secrets-Manager-aware connection string isn't yet
plumbed through the wizard.

## Sample `config.yml`

```yaml
db_profiles:
  rs_prod:
    backend: redshift
    host: my-cluster.abc123.us-east-1.redshift.amazonaws.com
    port: 5439
    database: analytics
    user: amx_reader
    profiling_mode: sampled
```

## Capabilities

- Postgres-compatible `COMMENT ON …` for write-back.
- Distinctive object types listable via `/metadata`: materialized views, stored procedures,
  UDFs, **datashares** (Redshift's cross-cluster sharing primitive), **external tables**
  (Spectrum).
- **Analytics metadata** exposes Redshift-specific `diststyle` / `sortkey1` / encoding
  signals — these are surfaced in the Profile Agent prompt because they often correlate
  with what the column is for (e.g., `diststyle=KEY ON customer_id` is strong evidence
  that the column is the join key for downstream consumers).

## Required permissions

```sql
CREATE USER amx_reader PASSWORD '…';
GRANT USAGE ON SCHEMA public TO amx_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO amx_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO amx_reader;
-- For comment write-back:
GRANT ALL ON ALL TABLES IN SCHEMA public TO amx_reader;
```

## Known limitations

- Redshift Serverless: same adapter, but the connection string uses the Serverless
  workgroup hostname. AMX does not yet auto-detect serverless and skip cluster-specific
  metadata queries — they fail gracefully with an actionable error.
- Spectrum external tables are listed but their underlying S3 data isn't sampled. The
  Profile Agent works from the external table's declared schema only.
- Datashares are listed but not analysed for their consumer-side semantics.
