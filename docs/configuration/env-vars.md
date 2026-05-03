# Environment variables

A handful of `AMX_*` and standard env vars affect AMX's behaviour. None are required —
sensible defaults apply if you set nothing.

## LLM and reasoning routes

| Variable | Default | Description |
|---|---|---|
| `AMX_LLM_MIN_MAX_TOKENS` | `16384` | Floor for `max_tokens` on recognised reasoning routes (o-series, gpt-5, kimi-k2-thinking, Claude extended thinking). Auto-applied when `_supports_thinking()` is true. |
| `AMX_REASONING_EFFORT` | `medium` (OpenAI direct) / `low` (OpenRouter) | `low` / `medium` / `high`. Sent as `reasoning_effort` to OpenAI direct; sent as `reasoning.effort` to OpenRouter. |

OpenRouter rejects sending both `reasoning.effort` and `reasoning.max_tokens` together —
AMX sends `effort` only.

## Cloud document access

| Variable | Required when | Description |
|---|---|---|
| `AMX_GOOGLE_SERVICE_ACCOUNT_JSON` | Private Google Drive files / folders | Path to a Google service account JSON. Share the file/folder with that service account email. |
| `AMX_GOOGLE_OAUTH_TOKEN_JSON` | Alternative to service account | Path to a user OAuth token JSON from a prior consent flow. |
| `AMX_AZURE_TENANT_ID` | Private SharePoint / OneDrive | Azure AD tenant id. |
| `AMX_AZURE_CLIENT_ID` | Private SharePoint / OneDrive | Azure AD app registration client id. |
| `AMX_AZURE_CLIENT_SECRET` | Private SharePoint / OneDrive | Azure AD app registration client secret. The app needs Microsoft Graph permissions **Files.Read.All** and **Sites.Read.All**. |

Public sharing links work without any of these — AMX always tries the anonymous download
first. See [Documents](../data-sources/documents.md#cloud-document-access).

## AWS S3

S3 uses the standard AWS credential chain. AMX does not introduce custom env vars for
S3 — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, `AWS_REGION`, and
`~/.aws/credentials` all work as expected.

## Databricks TLS

| Variable | Description |
|---|---|
| `AMX_DATABRICKS_TRUSTED_CA_FILE` | Path to a CA bundle PEM file for Databricks workspaces behind a corporate proxy. AMX-specific — checked before generic vars. |
| `DATABRICKS_TRUSTED_CA_FILE` | Path to a CA bundle PEM file. Used by the Databricks SDK; AMX honours it as a fallback. |
| `REQUESTS_CA_BUNDLE` | Generic CA bundle. AMX honours it as a fallback for Databricks if no Databricks-specific var is set. |
| `SSL_CERT_FILE` | Last-resort fallback. |

The order AMX checks: `tls_trusted_ca_file` field on the DB profile → `AMX_DATABRICKS_TRUSTED_CA_FILE` →
`DATABRICKS_TRUSTED_CA_FILE` → `REQUESTS_CA_BUNDLE` → `SSL_CERT_FILE`.

The first configured bundle wins. The successful path is saved back into the active DB
profile so subsequent runs use it directly.

See [Databricks → TLS notes](../backends/databricks.md#tls-notes) and
[TLS and proxies](tls-and-proxies.md).

## Standard Python env vars AMX honours

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` (alias `GEMINI_API_KEY`),
  `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY` — used as fallback if no per-profile key is
  configured.
- `OPENAI_ORG_ID`, `OPENAI_PROJECT` — added to OpenAI request headers when set.
- `GOOGLE_APPLICATION_CREDENTIALS` — used by the Gemini and BigQuery SDKs for
  service-account auth.
- `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY` — honoured by every backend driver and the LLM
  HTTP layer.

## Logging

| Variable | Default | Description |
|---|---|---|
| `AMX_LOG_LEVEL` | `INFO` | One of `DEBUG`, `INFO`, `WARNING`, `ERROR`. Applies to `~/.amx/logs/amx.log` and stderr. |
| `AMX_LOG_FORMAT` | `console` | `console` (Rich-formatted) or `json` (one event per line, useful for log shippers). |

Third-party LiteLLM warnings / debug lines are suppressed by default; AMX surfaces only
its own actionable warnings.

## Setting env vars per project

Drop a `.env` file in your project root and AMX picks it up via [python-dotenv](https://pypi.org/project/python-dotenv/):

```dotenv
OPENAI_API_KEY=sk-...
AMX_LOG_LEVEL=DEBUG
AMX_REASONING_EFFORT=high
```

The `.env` is loaded once when `amx` starts. Restart the session if you change it.

## Where to confirm what's active

```bash
amx doctor
```

prints which env vars AMX has detected (without the values, for safety).
