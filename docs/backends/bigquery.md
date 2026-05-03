# BigQuery

## Install

```bash
pip install "amx[bigquery]"
```

Drivers: `sqlalchemy-bigquery`, `google-cloud-bigquery`.

## Connection fields

| Field | Required | Notes |
|---|---|---|
| `project` | yes | GCP project id |
| `dataset` | yes | Default dataset; can be overridden per-run |
| `credentials_path` | conditional | Path to a service account JSON file |
| `location` | no | Region for BigQuery jobs (`EU`, `US`, etc.) |

If `credentials_path` is empty, AMX falls back to Application Default Credentials (ADC) —
useful when running on GCE / Cloud Run / from a workstation with `gcloud auth application-default login`.

## Sample `config.yml`

```yaml
db_profiles:
  bq_prod:
    backend: bigquery
    project: my-gcp-project
    dataset: warehouse
    credentials_path: ~/.gcp/amx-sa.json
    location: EU
    profiling_mode: sampled
```

## Capabilities

- Comment write-back via `ALTER TABLE … ALTER COLUMN … SET OPTIONS(description='…')`.
- Distinctive object types listable via `/metadata`: routines (procedures + functions),
  external tables.
- `TABLESAMPLE SYSTEM` used in `sampled` profiling mode.
- Falls back to lightweight metadata + samples when row-count statistics are unavailable.

## Cost guardrails

BigQuery bills per byte scanned. AMX defaults are conservative:

- `metadata` mode does not scan table data at all.
- `sampled` mode uses `TABLESAMPLE SYSTEM` so a small fraction of blocks is read.
- `full` mode runs `SELECT COUNT(*)` and per-column distinct/null counts. For large
  partitioned tables this can be expensive — switch to `sampled` for routine work and
  reserve `full` for spot checks.

## Required permissions

The service account needs:

- `bigquery.datasets.get`, `bigquery.tables.list`, `bigquery.tables.get`,
  `bigquery.tables.getData` (read).
- `bigquery.tables.update` for comment write-back.
- `bigquery.jobs.create` to run queries.

The pre-defined role `BigQuery Data Editor` plus `BigQuery Job User` covers all of these.

## Known limitations

- BigQuery **project-level descriptions** are blocked before connection — the API doesn't
  expose them. AMX surfaces this as a `not supported on this backend` rather than failing
  midway.
- Authorized views and row-level access policies are honoured but invisible to AMX.
- Streaming inserts are not surfaced as a separate object type.
