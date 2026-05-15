# `~/.amx/config.yml`

AMX persists profiles and settings to `~/.amx/config.yml`. The file is part of the
public surface — you can hand-edit it, version it, and template it with environment
variables. This page walks through the schema (currently `schema_version: 2`), shows a
fully-annotated example covering every supported field, and lists the operations AMX
performs on the file under the hood.

## Prerequisites

- AMX installed (`pip install amx-cli`).
- A text editor and basic YAML familiarity.

## Where the file lives

```text
$AMX_CONFIG_DIR/config.yml      # if AMX_CONFIG_DIR is set
~/.amx/config.yml               # default
```

`/setup` and the `/add-…-profile` wizards write to this file. Hand-edits are picked up
on the next AMX start (or `> /config reload` from inside an active session).

## Step-by-step — bootstrap a fresh config

### 1. Let `/setup` write the first version

```bash
amx
> /setup
[1/3] Database profile (default) ...
[2/3] LLM profile (default) ...
[3/3] Optional document/code profiles ...
✓ Saved to ~/.amx/config.yml
```

After `/setup`, the file is minimal — three sections (db, llm, optional docs) plus the
schema version header.

### 2. Inspect what got written

```text
> /config show
schema_version: 2
db_profiles:
  default:
    backend: postgresql
    host: db-prod.eu-west-1.rds.amazonaws.com
    port: 5432
    user: amx_reader
    password: keyring://amx/default/password
    database: analytics
active_db_profile: default
llm_profiles:
  default:
    provider: openai
    model: gpt-4o
    api_key: keyring://amx/default/api_key
active_llm_profile: default
```

### 3. Hand-edit for non-wizard fields

Some settings (e.g. `max_bytes_billed` for BigQuery, `thinking_budget_tokens` for
Anthropic, `tls_trusted_ca_file` for Databricks) aren't asked for by the wizard.
Add them by hand under the relevant profile.

```yaml
db_profiles:
  prod-bq:
    backend: bigquery
    project: acme-analytics-prod
    dataset: sales_curated
    credentials_path: ""
    max_bytes_billed: 10737418240   # ← hand-added: 10 GB safety net
```

### 4. Reload without restarting AMX

```text
> /config reload
✓ Config reloaded. Active DB profile: prod-bq, active LLM profile: openai-prod.
```

## Annotated example — every supported field

```yaml
# ─────────────────────────────────────────────────────────────────────
# Schema version. AMX migrates older files forward automatically; if this
# is newer than the AMX binary you're running, AMX refuses to start so a
# downgrade can't silently corrupt fields it doesn't know about.
schema_version: 2

# ─────────────────────────────────────────────────────────────────────
# Single-DB shortcut. `db:` (without -profiles) is treated as the
# `default` profile; everything below in db_profiles wins if both are set.
db:
  backend: postgresql
  host: localhost
  port: 5432
  user: amx
  password: ""
  database: ""
  profiling_mode: sampled         # full | sampled | metadata
  profiling_max_rows: 1000000     # cap row count even in `full` mode
  profiling_sample_size: 5000     # row count when `sampled`

# ─────────────────────────────────────────────────────────────────────
# Multi-DB profile registry. Each key is a profile name.
db_profiles:
  prod-pg:
    backend: postgresql
    host: db-prod.eu-west-1.rds.amazonaws.com
    port: 5432
    user: amx_reader
    password: keyring://amx/prod-pg/password
    database: analytics
    profiling_mode: sampled
    profiling_sample_size: 5000

  prod-sf:
    backend: snowflake
    account: xy12345.eu-west-1
    user: AMX_READER
    password: keyring://amx/prod-sf/password
    database: ANALYTICS
    warehouse: WH_AMX_XS
    role: AMX_READER_ROLE

  prod-dbx:
    backend: databricks
    host: adb-1234567890123456.7.azuredatabricks.net
    http_path: /sql/1.0/warehouses/abc1234567890
    access_token: keyring://amx/prod-dbx/access_token
    catalog: main
    database: sales
    tls_trusted_ca_file: ""
    tls_no_verify: false

  prod-bq:
    backend: bigquery
    project: acme-analytics-prod
    dataset: sales_curated
    credentials_path: ""           # blank → ADC
    max_bytes_billed: 10737418240

# Single active DB (back-compat for tools still reading the legacy scalar).
# Tracks the first entry of active_db_profiles below.
active_db_profile: prod-pg

# Multi-DB scope. /run / /sync / /ask all operate across every profile
# listed here in a single pass — Studio's browse sidebar shows all of
# them as expandable rows, /ask catalog tools span them via SQL IN
# clauses, and live-DB tools (list_schemas, list_databases, …) fan out
# in parallel with an 8-second per-profile timeout.
#
# Set via /use-db a b c (persisted) or /session scope a b (chat-session
# sticky). Studio's Ask page has a multi-select scope dropdown that
# does the same per chat.
active_db_profiles: [prod-pg, prod-bq]

# ─────────────────────────────────────────────────────────────────────
# Single-LLM shortcut, parallels `db:` above.
llm:
  provider: openai
  model: gpt-4o
  api_key: ""
  temperature: 0.2
  n_alternatives: 3
  column_batch_size: 10
  logprob_high: 0.85
  logprob_medium: 0.50
  alternatives_mode: semantic         # diversity dimension; see Concepts → Alternatives mode
  confidence_signal: self_consistency # per-alternative scorer; see Concepts → Confidence signals

llm_profiles:
  openai-prod:
    provider: openai
    model: gpt-4o
    api_key: keyring://amx/openai-prod/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 10
    logprob_high: 0.85
    logprob_medium: 0.50
    alternatives_mode: semantic         # or: lexical
    confidence_signal: self_consistency # or: logprob | self_decl | judge | none

  anthropic-deep:
    provider: anthropic
    model: claude-sonnet-4-20250514
    api_key: keyring://amx/anthropic-deep/api_key
    column_batch_size: 8
    thinking_budget_tokens: 4000   # extended thinking budget per request

  openai-batch:
    provider: openai
    model: gpt-4o-mini
    api_key: keyring://amx/openai-batch/api_key
    column_batch_size: 20
    batch_mode: true
    batch_poll_interval_s: 60
    batch_max_wait_s: 86400

active_llm_profile: openai-prod

# ─────────────────────────────────────────────────────────────────────
# Optional: documents (RAG) and codebase (Code agent) profiles.
doc_profiles:
  default:
    - /opt/internal-docs/data-platform/
    - /opt/internal-docs/data-warehouse-handbook.pdf
active_doc_profile: default

code_profiles:
  default: /Users/me/work/dbt-project
active_code_profile: default

# ─────────────────────────────────────────────────────────────────────
# Search catalog (RAG embeddings + Chroma store).
search:
  embedding_model: openai/text-embedding-3-small
  top_k: 8
  index_store: ~/.amx/chroma

# ─────────────────────────────────────────────────────────────────────
# Optional: shared history store. When set, /history is read from and
# written to a database table instead of the local file. Use to share
# audit trails across team machines.
history_store_enabled: false
history_store_profile: ""        # name of a db_profile entry
history_store_schema: AMX
```

Two of the LLM-profile knobs in the example above shape the *kind* of
output AMX produces rather than which model runs:

* `alternatives_mode` controls whether `DESCRIPTION_2..N` are
  paraphrases of `DESCRIPTION_1` (`semantic`) or share vocabulary
  with shifted meaning (`lexical`). See
  [Alternatives mode](../concepts/alternatives-mode.md) for the full
  reference and worked examples.
* `confidence_signal` picks which scorer drives the HIGH / MED / LOW
  pill on each alternative. Options: `self_consistency` (default),
  `logprob`, `self_decl`, `judge`, `none`. See
  [Confidence signals](../concepts/confidence-signals.md) for what
  each one measures and how to read the bands.

## Field reference (per profile)

| Field | Backends | Required | Notes |
|---|---|---|---|
| `backend` | all | yes | One of `postgresql`, `snowflake`, `databricks`, `bigquery`, `mysql`, `oracle`, `mssql`, `redshift`, `clickhouse`, `duckdb` |
| `host` / `port` | most | yes | Validated. Port must be a number |
| `user` / `password` | most | yes | Password resolves `keyring://` URIs to OS-keychain values |
| `database` | most | optional (0.11+) | Leave blank to defer choice to `/run` / `/sync` |
| `account` | snowflake | yes | The bare account identifier (no `.snowflakecomputing.com`) |
| `warehouse` / `role` | snowflake | optional | Left blank → user defaults |
| `http_path` / `access_token` / `catalog` / `tls_trusted_ca_file` / `tls_no_verify` | databricks | yes (`http_path`, `access_token`) | See [Databricks](../backends/databricks.md) |
| `project` / `dataset` / `credentials_path` / `max_bytes_billed` | bigquery | yes (`project`) | Empty `credentials_path` = ADC |
| `service_name` | oracle | optional | Preferred over `database` (=SID) for modern Oracle |
| `driver` / `encrypt` / `trust_server_certificate` | mssql | optional | Defaults: `ODBC Driver 18 for SQL Server`, `True`, `False` |
| `cluster_identifier` / `secure` | redshift / clickhouse | optional | Redshift IAM auth, ClickHouse HTTPS toggle |
| `profiling_mode` / `profiling_max_rows` / `profiling_sample_size` | all | optional | See [Profiling modes](profiling-modes.md) |

## Verify

1. `> /config show` — pretty-prints the parsed config (secrets masked).
2. `> /config validate` — re-runs the schema validator without modifying anything; surfaces any unknown keys or type mismatches.
3. `> /doctor` — checks the active profile actually reaches the resolved endpoints.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ConfigSchemaTooNewError: file is schema_version 3, this AMX is at 2` | YAML written by a newer AMX version | Upgrade AMX (`pip install -U amx-cli`) or downgrade the file |
| Secrets visible in plain text | `keyring://` resolution failed (no OS keychain available) | Either install a keychain backend (`secretstorage` on Linux) or accept plaintext + `chmod 600 ~/.amx/config.yml` |
| `unknown field 'foo' in profile 'bar'` | Hand-edit added a typo | Run `> /config validate` to surface the offending key |
| Edits don't take effect | AMX caches at start; `/config reload` not run | `> /config reload` (or restart AMX) |
| Multiple machines disagree on the audit trail | Local history is per-machine | Enable `history_store_enabled: true` — see [Shared history store](../collaboration/shared-history-store.md) |
