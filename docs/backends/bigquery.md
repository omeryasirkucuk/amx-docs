# BigQuery

Configure BigQuery as an AMX backend to introspect datasets, tables, views, materialized
views, and routines, and write reviewed descriptions back via
`ALTER TABLE … SET OPTIONS(description = '…')` and column `OPTIONS`. This page walks
through registering a project profile, picking between Application Default Credentials
and a service-account JSON, and applying your first batch of generated descriptions
without an unbounded byte scan.

## Prerequisites

- AMX installed (`pip install amx`). The `google-cloud-bigquery` and `sqlalchemy-bigquery` drivers are included by default.
- A GCP project with the BigQuery API enabled.
- One of:
    - **ADC (recommended for laptops / GKE / Cloud Run)** — `gcloud auth application-default login` already run, OR a workload-identity binding in place.
    - **Service-account JSON** — a key file with `BigQuery Data Viewer` (read), `BigQuery Job User` (run jobs), and `BigQuery Metadata Editor` (write descriptions) roles on the target dataset(s).
- A default dataset is optional but recommended — without one, every command pauses for the dataset picker.
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

Pick `bigquery` from the backend menu:

```text
Select database backend (engine):
  ...
  bigquery   GCP project + dataset - table/column descriptions via OPTIONS
  ...
> bigquery
```

### 3. Answer the connection prompts

```text
GCP project ID (e.g. my-company-prod): acme-analytics-prod
Default dataset (optional, e.g. analytics): sales_curated
Service account JSON path (optional, e.g. /etc/gcp/sa.json — uses ADC if empty):
```

Notes on each field:

- **Project ID** — required. The bare project ID (no `projects/` prefix, no number).
- **Default dataset** — optional. Filling it in scopes `/schemas` and `/run` so commands don't pause to ask. Leave blank for cross-dataset discovery.
- **Service account JSON path** — optional. **Leave blank to use ADC** (which picks up `gcloud` user creds, a Compute Engine service account, or a workload identity automatically). Fill in the path only if you need a specific key file — useful for CI runners.

!!! tip "ADC vs service-account JSON — which to pick"
    Use ADC when AMX runs on your laptop (`gcloud auth application-default login` once and you're done) or inside any Google-managed runtime that has a service account attached (Cloud Run, GKE with Workload Identity, Compute Engine).
    
    Use a service-account JSON only when AMX runs in a non-Google CI runner (GitHub Actions, GitLab self-hosted) where you need to ship the credential as a secret. Mount it as a file, set the path in the wizard, and never check it into the repo.

### 4. Activate and confirm

```text
> /use-db prod-bq
✓ Active DB profile → prod-bq [bigquery] acme-analytics-prod / sales_curated

> /connect
Testing prod-bq... ✓ connected (project: acme-analytics-prod, ADC: gcloud user me@acme.com, latency: 184 ms)
```

If you provided a service-account JSON, the line reads `ADC: file /etc/gcp/sa.json (sa-amx@acme-analytics-prod.iam.gserviceaccount.com)`.

### 5. Inspect datasets and tables

```text
> /schemas
dataset                   tables   views   matviews   routines
sales_curated             47       12      3          8
sales_raw                 124      0       0          0
finance_curated           19       6       1          2

> /tables sales_curated
dataset         name              kind    rows         size_gb   comment?
sales_curated   customer          TABLE   2,450,118    1.4       no
sales_curated   customer_address  TABLE   2,450,118    0.9       no
sales_curated   inventory_daily   TABLE   45,318,234   28.2      yes
```

`size_gb` is the on-disk billable size, not row count. AMX uses it to refuse `full`-mode
profiling on tables that would scan more than your `max_bytes_billed` setting.

### 6. Pick a profiling mode that fits your byte budget

```text
> /db profiling-mode sampled
✓ Active mode → sampled (TABLESAMPLE SYSTEM, 5000 rows)

> /db inspect
Active backend: bigquery (acme-analytics-prod / sales_curated)
Profiling mode: sampled
Estimated bytes per /run sweep: ~120 MB across 47 tables
Max bytes billed (configured): 10 GB
```

Recommended modes for BigQuery:

- **`metadata`** — INFORMATION_SCHEMA only. Zero bytes scanned. Use for cross-dataset inventory.
- **`sampled`** — `TABLESAMPLE SYSTEM`. Bills the sampled bytes (typically a few MB per table). Default for description drafting.
- **`full`** — full table scan. Bill at the per-table size. Reserve for tables under ~1 GB or when you genuinely need exact distinct counts.

### 7. Run and apply

```text
> /run sales_curated.customer
[Profile] TABLESAMPLE SYSTEM on sales_curated.customer ... ok (1.1 s, 1.2 MB billed)
[LLM]     drafting 18 column descriptions ... ok (high: 12, medium: 4, low: 2)

> /apply
Write 18 description(s) to acme-analytics-prod.sales_curated? [y/N]: y

ALTER TABLE  acme-analytics-prod.sales_curated.customer SET OPTIONS(description='Master customer record …');
ALTER TABLE  acme-analytics-prod.sales_curated.customer
  ALTER COLUMN c_customer_sk SET OPTIONS(description='Surrogate key …');
... (18/18 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

## Sample config

```yaml
db_profiles:
  prod-bq:
    backend: bigquery
    project: acme-analytics-prod
    dataset: sales_curated
    credentials_path: ""           # ADC; or "/etc/gcp/sa.json" for a key file
    profiling_mode: sampled
    profiling_sample_size: 5000
    max_bytes_billed: 10737418240  # 10 GB safety net
active_db_profile: prod-bq
```

## Verify

1. `> /connect` — reports the active project and the resolved ADC source. If the line reads `ADC: none` you have neither user creds nor a key file; re-run `gcloud auth application-default login` or set `credentials_path:`.
2. `> /db inspect` — shows the configured `max_bytes_billed` ceiling so you know the safety net is in place before the first `/run`.
3. `> amx doctor` — checks the BigQuery driver loaded and the profile is reachable (a 401/403 there usually means the IAM grants are missing).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `google.auth.exceptions.DefaultCredentialsError: Could not automatically determine credentials.` | No ADC and no service-account path | `gcloud auth application-default login` OR set `credentials_path:` to a service-account JSON |
| `403 Access Denied: Project … User does not have bigquery.jobs.create` | Account/SA lacks `BigQuery Job User` | Grant `roles/bigquery.jobUser` on the project (or use a different SA) |
| `403 Access Denied: Table … User does not have bigquery.tables.update` | Account/SA can read but not write descriptions | Grant `roles/bigquery.metadataEditor` on the dataset |
| `Quota exceeded: Your project exceeded quota for free query bytes scanned` | Default project has the free-tier ceiling | Switch to a billed project, or set `profiling_mode: metadata` for the discovery sweep |
| `400 Cannot read non-existent column …` mid-run | Sampled rows from a partition with a different schema | Run with `profiling_mode: metadata` first to confirm column lists per partition; then re-run on the latest partition explicitly |
| `Bytes billed exceeded the maximum (10737418240)` | A `full`-mode `/run` hit your `max_bytes_billed` ceiling | Switch the table to `sampled` or raise the ceiling for the duration of the sweep |

## What's next

- [Profiling modes](../configuration/profiling-modes.md) — `metadata` for inventory, `sampled` for description drafting, `full` only when you need exact stats.
- [Batch mode for LLM calls](../llm-providers/batch-mode.md) — pair with BigQuery `metadata` mode for dirt-cheap whole-warehouse description sweeps.
- [Run & Apply](../cli/run-and-apply.md) — the review wizard, including how `/apply` handles partial failures.
