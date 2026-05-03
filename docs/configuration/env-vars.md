# Environment variables

A handful of `AMX_*` and standard env vars affect AMX's behaviour. None are required —
the wizard works without setting any — but they let you keep secrets out of files,
override config-yml entries for one shell, and integrate AMX into CI pipelines without
hand-edits to `~/.amx/config.yml`. This page lists every variable AMX reads and shows
the most useful patterns.

## Prerequisites

- AMX installed.
- A shell where you can `export` env vars (or a CI runner that injects them).

## Step-by-step

### 1. Override the config dir for an isolated run

```bash
AMX_CONFIG_DIR=/tmp/amx-test amx
# inside the REPL:
# > /setup
```

The wizard creates `/tmp/amx-test/config.yml` instead of touching `~/.amx`. Useful for:
running AMX inside a sandbox; trying a clean config without losing your daily one;
running CI tests that mustn't pollute the dev machine.

### 2. Inject secrets via env in CI

```bash
export AMX_DB_PASSWORD="$DB_PASSWORD"           # CI secret
export OPENAI_API_KEY="$OPENAI_API_KEY"         # CI secret

> /run sales --profiling-mode metadata --auto-accept-high --apply
```

With these env vars set, the YAML can ship `password: ""` and `api_key: ""` (no secrets
on disk); AMX picks the values up from env at session start.

### 3. Point AMX at an Azure OpenAI endpoint without a separate provider

```bash
export OPENAI_API_BASE="https://my-azure-openai.openai.azure.com/"
export OPENAI_API_KEY="$AZURE_OPENAI_KEY"

> /llm test
```

The OpenAI provider transparently switches to Azure routing.

### 4. Verbose logging without changing the YAML

```bash
AMX_LOG=debug amx
# inside the REPL:
# > /run sales.customer
```

Equivalent to passing `--debug` to every command in the session.

## Variable reference

### Path / config

| Variable | Default | What it does |
|---|---|---|
| `AMX_CONFIG_DIR` | `~/.amx` | Where AMX reads / writes `config.yml`, sessions, history file, Chroma index |
| `AMX_LOG` | `info` | Log level: `debug` / `info` / `warning` / `error` |
| `AMX_NO_COLOR` | unset | If set (any value), disable ANSI color in output |
| `AMX_NO_KEYRING` | unset | If set, skip OS keychain — store secrets plaintext in `config.yml` |
| `AMX_NO_NETWORK` | unset | If set, skip the connectivity ping at every `/run` start |
| `AMX_PROFILE_DEFAULT` | unset | Default profile name to use when none is active (rare; useful in CI) |

### Database secrets (override per-profile values)

| Variable | What it does |
|---|---|
| `AMX_DB_PASSWORD` | Override the active DB profile's password |
| `AMX_DB_HOST` | Override the active DB profile's host |
| `AMX_DB_USER` | Override the active DB profile's user |
| `AMX_DB_DATABASE` | Override the active DB profile's database |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | Standard libpq vars; respected by the PostgreSQL adapter |
| `PGSSLMODE` | `require` / `verify-ca` / `verify-full` — TLS mode for PostgreSQL |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PWD` | Standard MySQL vars |
| `SNOWFLAKE_ACCOUNT` / `SNOWFLAKE_USER` / `SNOWFLAKE_PASSWORD` / `SNOWFLAKE_WAREHOUSE` / `SNOWFLAKE_ROLE` | Standard Snowflake vars |
| `DATABRICKS_HOST` / `DATABRICKS_TOKEN` | Standard Databricks vars |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to BigQuery service-account JSON (overrides `credentials_path:`) |
| `AWS_PROFILE` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Standard boto3 vars; used by Redshift IAM auth |

### LLM provider keys

| Variable | What it does |
|---|---|
| `OPENAI_API_KEY` | Used when an OpenAI profile has `api_key: ""` |
| `OPENAI_API_BASE` | Override OpenAI base URL — Azure OpenAI / proxy use cases |
| `OPENAI_ORG_ID` | OpenAI organisation header |
| `ANTHROPIC_API_KEY` | Used when an Anthropic profile has `api_key: ""` |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Used by the Gemini provider |
| `OPENROUTER_API_KEY` | OpenRouter |
| `DEEPSEEK_API_KEY` | DeepSeek |

### TLS / proxy

| Variable | What it does |
|---|---|
| `HTTPS_PROXY` / `HTTP_PROXY` | Standard proxy vars; AMX uses urllib's resolution |
| `NO_PROXY` | Standard exclusion list |
| `REQUESTS_CA_BUNDLE` | CA bundle for HTTPS calls (LLM providers, Databricks, BigQuery) |
| `SSL_CERT_FILE` | Same as above; some libraries prefer this name |
| `AMX_DBX_TLS_NO_VERIFY` | If set, disable TLS verification on Databricks (insecure debug) |

### Oracle thick mode

| Variable | What it does |
|---|---|
| `AMX_ORACLE_LIB_DIR` | Path to Oracle Instant Client; switches the `oracledb` driver from thin to thick mode |
| `TNS_ADMIN` | Oracle TNS / wallet directory |

## Resolution order

For any field that has a YAML value, an env var, AND a CLI flag, the order is:

1. **CLI flag** (highest priority — `--db-profile`, `--profiling-mode`, etc.)
2. **Env var** (e.g. `AMX_DB_PASSWORD`)
3. **YAML value** (`db_profiles.<active>.password`)
4. **Default** (lowest)

This matches the convention used by most CLIs — explicit beats env beats config beats
default.

## Sample patterns

### CI pipeline (no secrets on disk)

```bash
# Repository: ~/.amx/config.yml committed with empty secrets
db_profiles:
  ci:
    backend: postgresql
    host: ""
    port: 5432
    user: ""
    password: ""
    database: ci_test
active_db_profile: ci

# CI runner injects env vars per job:
export AMX_DB_HOST="$CI_DB_HOST"
export AMX_DB_USER="$CI_DB_USER"
export AMX_DB_PASSWORD="$CI_DB_PASSWORD"
export OPENAI_API_KEY="$CI_OPENAI_KEY"

> /run --profiling-mode metadata --auto-accept-high --apply
```

### One-off scratch profile in a temp dir

```bash
AMX_CONFIG_DIR=$(mktemp -d) amx
> /setup
# explore...
> /exit
# the temp dir is auto-cleaned when the shell exits (it's just a normal dir)
```

### Debugging a corporate-proxy-blocked LLM call

```bash
HTTPS_PROXY=http://proxy.corp:8080 \
REQUESTS_CA_BUNDLE=/etc/ssl/corp-bundle.pem \
AMX_LOG=debug \
> /llm test
```

## Verify

1. `> /config show --include-env` — pretty-prints the resolved values, marking which came from env (`<- env: OPENAI_API_KEY`).
2. `> /doctor` — verifies the env-derived secrets actually authenticate.
3. `> /db connect` — runs a real round-trip with the resolved credentials.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Env override seems ignored | The YAML profile's value was non-empty (env only fills in blank fields) | Set the YAML value to `""` to let env take over, OR use `--db-profile <name-with-blank>` |
| `OPENAI_API_BASE` works for the SDK but not for `/llm test` | URL needs the trailing `/v1` | Set `https://my-azure.openai.azure.com/openai/deployments/<deployment>/`. Azure deployments are nested |
| `keyring://` URI not resolved | `AMX_NO_KEYRING` is set, OR no OS keychain is reachable | Unset it, or install a keychain backend (`secretstorage` on Linux); fallback is plaintext in YAML with `chmod 600` |
| `AWS_*` env vars ignored on Redshift IAM auth | The YAML profile has a non-empty `password` | Set `password: ""` in the YAML; AMX uses IAM only when password is blank |

## What's next

- [`config.yml`](config-yml.md) — what fields these env vars actually override.
- [TLS and proxies](tls-and-proxies.md) — full proxy / CA bundle walkthrough.
- [Per-backend pages](../backends/index.md) — backend-specific env vars (e.g. `PGSSLMODE` for PostgreSQL).
