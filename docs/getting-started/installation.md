# Installation

AMX is a Python package distributed on PyPI. The default install is lean — pick the database
backends you actually use as optional extras.

## Prerequisites

- **Python 3.10 or newer.** AMX is tested on 3.10, 3.11, and 3.12.
- **A database you can connect to.** Any of the [10 supported backends](../backends/index.md).
- **At least one LLM provider configured.** OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter,
  Ollama, or any OpenAI-compatible local endpoint (vLLM / LM Studio / …).

AMX focuses on metadata inference, not bulk data loading. Populate schemas and tables with
your own ETL process, then point AMX at that database.

## Install from PyPI

The default install includes the CLI, the multi-agent runtime, all LLM SDKs, and the
RAG / search / codebase machinery. **Database drivers are opt-in extras** so the default
install stays under ~30 MB instead of ~100 MB.

=== "Single backend"

    ```bash
    pip install "amx[postgresql]"
    ```

=== "Multiple backends"

    ```bash
    pip install "amx[postgresql,snowflake,bigquery]"
    ```

=== "Everything"

    ```bash
    pip install "amx[all]"
    ```

If you forget the extra and try to use a backend without its driver, AMX raises
`MissingDriverError` (a subclass of `ImportError`) with the exact `pip install amx[<extra>]`
hint — no opaque `ModuleNotFoundError`.

### Available extras

| Extra | Drivers pulled in | Use when |
|---|---|---|
| `postgresql` | psycopg2 | Postgres-compatible engines (Postgres, Aurora) |
| `snowflake` | snowflake-sqlalchemy, snowflake-connector-python | Snowflake |
| `databricks` | databricks-sqlalchemy, databricks-sql-connector | Databricks Unity Catalog SQL warehouse |
| `bigquery` | sqlalchemy-bigquery, google-cloud-bigquery | Google BigQuery |
| `mysql` | pymysql, cryptography | MySQL / MariaDB |
| `oracle` | oracledb | Oracle |
| `mssql` | pyodbc | SQL Server (also requires the **ODBC Driver 18** at the OS level) |
| `redshift` | redshift_connector, sqlalchemy-redshift | Amazon Redshift |
| `clickhouse` | clickhouse-connect, clickhouse-sqlalchemy | ClickHouse |
| `duckdb` | duckdb-engine, duckdb | Local DuckDB files / `:memory:` |
| `code-intel` | sqlglot | Richer SQL parsing in `/code` scans |
| `local-embeddings` | sentence-transformers | Local embeddings (`/embeddings Local`) |
| `all` | every driver above | Combined |

## Install from source

For development or to track a feature branch:

```bash
git clone https://github.com/omeryasirkucuk/amx.git
cd amx
pip install -e ".[dev,code-intel,postgresql]"
pre-commit install
```

The `dev` extra adds pytest, ruff, mypy, and pre-commit. See [Contributing](../contributing.md)
for the full development workflow.

## Verify the install

```bash
amx --version
amx doctor
```

`amx doctor` reports every `amx` binary on `PATH` (catches the version-skew bug class), the
Python runtime, the config schema version, optional backend deps, and active DB + LLM
reachability. It runs from a broken state — no interactive session required. Use
`amx doctor --skip-network` for an offline quick check.

## Where AMX writes files

| Path | Purpose |
|---|---|
| `~/.amx/config.yml` | Profiles, settings (mode `0o600`) |
| `~/.amx/history.db` | Local SQLite: runs, results, app events, search catalog |
| `~/.amx/logs/amx.log` | Structured logs |
| `~/.amx/code_cache/<slug>/` | Cached code-scan results per profile |

Secrets are stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux
Secret Service) when available; the YAML stores a reference rather than the secret itself.

## Upgrading

```bash
pip install --upgrade amx
```

AMX uses semantic versioning. `0.x` is best-effort but breaking changes are flagged in the
[changelog](../changelog.md) under `BREAKING CHANGE`. Hard guarantees on the public Python
API and CLI surface kick in at `1.0.0` — see the [Python API page](../api/index.md) for the
full contract.

If a newer config schema is detected by an older AMX binary, AMX raises
`ConfigSchemaTooNewError` rather than silently mangling the file. Upgrade or downgrade
accordingly.

## Next steps

- [Quick start](quickstart.md) — five-minute happy path.
- [First run walkthrough](first-run.md) — narrated review session.
- [Per-backend setup](../backends/index.md) — connection details for each supported engine.
