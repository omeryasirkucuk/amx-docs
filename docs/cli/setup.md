# `/setup` & configuration

`/setup` is the interactive first-time configuration wizard. It walks you through three
profile types — database, LLM, and (optional) data sources — and saves everything to
`~/.amx/config.yml`.

## Running the wizard

```text
amx
/setup
```

The wizard is **idempotent** and **resumable** — re-running it surfaces existing profiles
and lets you add new ones, edit fields, or pick which one is active.

## Step 1 — Database profile

Pick an engine, then enter that engine's connection details:

| Engine | What you'll need |
|---|---|
| PostgreSQL | host, port, database, user, password |
| Snowflake | account, user, password (or key-pair / SSO), warehouse, role, database, schema |
| Databricks | host, HTTP path, PAT, catalog, schema (+ optional CA bundle for corporate TLS) |
| BigQuery | project, dataset, credentials JSON path |
| MySQL | host, port, database, user, password |
| Oracle | host, port, service name (preferred) or SID, user, password |
| SQL Server | server, port, database, user, password (requires ODBC Driver 18 at OS level) |
| Redshift | host, port, database, user, password |
| ClickHouse | host, port, database, user, password |
| DuckDB | file path or `:memory:` |

Per-backend setup pages: [Backends](../backends/index.md).

## Step 2 — LLM profile

Pick a provider:

- `openai`
- `openrouter`
- `anthropic`
- `gemini`
- `deepseek`
- `ollama` — uses base URL `http://localhost:11434` (no `/v1`)
- `local` — OpenAI-compatible local endpoint (`http://localhost:11434/v1` for vLLM /
  LM Studio / Ollama-OpenAI mode)

The wizard prompts for:

- API key (stored in OS keychain when available; the YAML keeps a reference)
- Model id
- Sampling temperature (default `0.2`, clamped to `[0.0, 2.0]`)
- Optional advanced fields (base URL for OpenAI-compatible endpoints, organisation, etc.)

For OpenRouter, enter the model in its natural provider/model form: `openai/gpt-4o-mini`,
`anthropic/claude-3.5-sonnet`, `qwen/qwen3.6-plus`. AMX handles the routing internally.

AMX normalises common provider-prefix typos in model ids — `oepnai/gpt-4o-mini` is
auto-corrected to the proper OpenAI namespace.

See [LLM Providers](../llm-providers/index.md) for the full per-provider matrix.

## Step 3 — Data source profiles (optional)

The wizard offers to configure document and codebase profiles. You can skip and add later:

- `/add-doc-profile [name]` — document roots for the RAG agent
- `/add-code-profile [name]` — codebase root(s) for the Code agent

Document profiles can mix local paths, GitHub URLs, S3 buckets, Google Drive links, and
SharePoint links. AMX checks reachability only at add time; full discovery happens at
`/index`. See [Documents](../data-sources/documents.md) and
[Codebase](../data-sources/codebase.md).

## Viewing configuration

```text
/config
```

Shows the active profiles (DB, LLM, doc, code), profiling guardrails, language, prompt
detail, alternatives count, and other knobs. Useful before starting a long `/run` to
confirm you're pointed at the right profiles.

## LLM profiles

Once you have at least one LLM profile, manage them per-namespace:

```text
/llm
/llm-profiles            # list
/use-llm openai_main     # switch active
/temperature 0.7         # update active profile temperature
/n-alternatives 3        # number of drafts per column (1–5)
/alternatives-mode lexical    # semantic | lexical — see Concepts → Alternatives mode
/confidence-signal logprob    # self_consistency | logprob | self_decl | judge | none
/language en             # generated metadata language for /run and /run-apply
```

Notes:

- `/llm` settings are saved per **active LLM profile**, and the command feedback prints
  the profile name that was updated.
- `/language` controls generated metadata language; `/search` answers follow the user's
  question language.
- Profile selections made in the interactive `/run` wizard are persisted to
  `~/.amx/config.yml` immediately.
- `max_tokens` defaults to `4096`. When `finish_reason=length`, AMX halts processing so
  truncated JSON is not parsed silently.
- `force_logprobs` defaults to `true` — AMX requests logprobs even when provider capability
  metadata is inconsistent.
- OpenAI Batch returns logprobs; Anthropic Batch does not, so those batch results keep
  model-declared confidence labels until merged by a logprob-capable chat call.
- `write_through_config` defaults to `true` — profile switches and config mutations are
  saved immediately.
- `/analyze /run` tests the active LLM **before** profiling any asset and stops if the
  model/profile is unreachable or deactivated.

## Where it lives

Config: `~/.amx/config.yml`. Use a different file with `amx --config path/to/config.yml`.

The schema is versioned — see [config.yml](../configuration/config-yml.md). Older AMX binaries
refuse to load a newer config rather than silently mangling it
(`ConfigSchemaTooNewError`).

Secrets land in the OS keychain when available (macOS Keychain, Windows Credential Manager,
Linux Secret Service) via [keyring](https://github.com/jaraco/keyring).
