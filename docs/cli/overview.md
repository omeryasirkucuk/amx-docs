# CLI overview

AMX is **interactive-first**. You start a session with `amx` and drive everything through
slash commands. A handful of one-shot subcommands (`amx doctor`, `amx db history-store …`)
also work directly from the shell — useful for scripts and CI.

## Starting a session

```bash
amx                          # uses ~/.amx/config.yml
amx --config ./team.yml      # custom config path
amx --help                   # surface all top-level options
amx --version
```

## The slash-command model

Commands are grouped by namespace. Type the namespace alone to see its commands and
shortcuts:

```text
/db
```

shows the database namespace's full menu. To run a command directly:

```text
/db connect
```

or, with auto-namespace-selection from the root prompt:

```text
/connect
```

AMX prints which namespace it auto-selected when there's no ambiguity.

## Namespaces

| Namespace | Purpose | Page |
|---|---|---|
| `/setup` | First-time configuration wizard | [Setup](setup.md) |
| `/config` | Show current configuration | [Setup](setup.md#viewing-configuration) |
| `/db` | DB profiles, connection, profiling, introspection, history-store | This page |
| `/metadata` (`/manual`) | Inspect / edit DB comments without LLM agents | This page |
| `/llm` | LLM profiles, language, temperature, batch sizes, thresholds | [Setup](setup.md#llm-profiles) |
| `/code` | Codebase profiles, scan, analyse | [Run & apply](run-and-apply.md) |
| `/docs` | Document profiles, ingest, search | [Run & apply](run-and-apply.md) |
| `/analyze` (`/run`) | The metadata generation pipeline | [Run & apply](run-and-apply.md) |
| `/search` (`/ask`) | Conversational metadata Q&A | [Ask & search](ask-and-search.md) |
| `/session` | `/ask` conversation session management | [Ask & search](ask-and-search.md#sessions) |
| `/history` | Run history, comparison, review | [History](history.md) |
| `/doctor` | Diagnostics | [Doctor](doctor.md) |
| `/usage` | Token + cost summary | [History](history.md#usage) |

## Slash command quick reference

The rest of this page is a single scrollable cheat sheet — every slash command grouped by
namespace. Per-command details live on the linked pages.

### `/db` — Database

| Command | Description |
|---|---|
| `/db-profiles` | List DB profiles (shows backend + connection summary per row) |
| `/use-db [name]` | Switch active profile; interactive picker lists each profile's engine |
| `/add-db-profile [name]` | Add/update a profile: choose engine first, then connection fields |
| `/remove-db-profile <name>` | Remove a DB profile |
| `/profiling [mode] [max_rows] [sample_size]` | Show or set DB profiling guardrails (`full` / `sampled` / `metadata`; `off` for no max-row cutoff) |
| `/tls [on\|off] [ca_path\|clear]` | Show or set Databricks TLS settings on the active profile |
| `/schema <name>` | Set default schema context |
| `/table <name>` | Set default table context |
| `/connect` | Test database connectivity |
| `/schemas` | List available schemas |
| `/tables [schema]` | List tables, views, and materialized views in a schema |
| `/profile [schema] [table]` | Profile table structure and data |
| `/inspect [profile]` | Diagnose a profile: backend, capabilities, connection test, visible schemas |
| `/history-store` | Open the shared-history-store picker (Status / Enable / Disable / …) |

See [Backends](../backends/index.md) for per-backend connection details.

### `/metadata` (alias `/manual`) — Database comments

| Command | Description |
|---|---|
| `/inspect [schema] [table]` | Show current database, schema, table/view, and column comments |
| `/edit` | Start the interactive edit wizard |
| `/edit <db>` | Edit a database/profile comment |
| `/edit <db>.<schema>` | Edit one schema comment |
| `/edit <db>.<schema>.<table>` | Edit one table/view comment |
| `/edit <db>.<schema>.<table>.<column>` | Edit one column comment |
| `/edit table <schema>.<table>` | Legacy scoped form (still supported) |
| `/monitor [schema]` | Show table/view and column comment coverage |

### `/llm` — LLM provider settings

| Command | Description |
|---|---|
| `/llm-profiles` | List LLM profiles |
| `/use-llm <name>` | Switch active LLM profile |
| `/add-llm-profile [name]` | Add/update an LLM profile (interactive) |
| `/remove-llm-profile <name>` | Remove an LLM profile |
| `/language [name]` | Show or set the metadata generation language for the active profile |
| `/temperature [N]` | Show or set sampling temperature (clamped to `[0.0, 2.0]`, default `0.2`) |
| `/prompt-detail [level]` | `minimal` \| `standard` \| `detailed` \| `full` |
| `/n-alternatives [N]` | Alternatives per column (1–5, default 3) |
| `/llm-batch-size [N]` | Columns per Profile-Agent LLM call |
| `/batch-context-columns [off\|all\|N]` | Non-batch column names included as context |
| `/logprob-thresholds [high] [medium]` | Confidence band thresholds |

### `/code` — Codebase analysis

| Command | Description |
|---|---|
| `/code-profiles` | List codebase profiles |
| `/use-code <name>` | Switch active codebase profile |
| `/add-code-profile [name]` | Add/update a codebase path (interactive) |
| `/remove-code-profile <name>` | Remove a codebase profile |
| `/code-scan [path]` | Scan codebase, save results, build `amx_code` semantic index |
| `/code-refresh` | Clear active code profile's scan cache and semantic chunks |
| `/code-results` | View the last cached code-scan results |
| `/code-analyze [TABLE …]` | Run Code Agent standalone (LLM); results saved for next `/run` |
| `/export-code-report [FILE]` | Export scan results to markdown |

### `/docs` — Document RAG

| Command | Description |
|---|---|
| `/doc-profiles` | List document path profiles |
| `/use-doc <name>` | Switch active document profile |
| `/add-doc-profile [name]` | Add/update document roots (interactive) |
| `/remove-doc-profile <name>` | Remove a document profile |
| `/scan [paths…]` | Scan and preview documents for RAG |
| `/ingest [paths…]` | Ingest documents into the RAG vector store (`--refresh` to re-upsert) |
| `/search-docs <text>` | Similarity search over ingested docs |
| `/doc-analyze [TABLE …]` | Run RAG Agent standalone (LLM); results saved for next `/run` |
| `/export-doc-report [FILE]` | Export RAG summary to markdown |

### `/analyze` (alias `/run`) — Run agents

| Command | Description |
|---|---|
| `/run [ASSET …]` | Run all agents with scope picker (`--code-profile`, `--code-refresh`, `--doc-profile`, `--llm-profile`) |
| `/run-apply [ASSET …]` | Same as `/run --apply` |
| `/apply` | Write pending approved metadata to the database |

### `/search` (alias `/ask`) — Conversational Q&A

| Command | Description |
|---|---|
| `/ask <question>` | Ask conversational metadata questions with grounded retrieval (`--actions` `--debug`) |
| `/status` | Catalog counts, freshness, and recent sync jobs |
| `/sources` | Enabled search settings and evidence-source coverage |
| `/config [key] [value]` | View or update `/search` settings for the active DB profile |
| `/context-detail [minimal\|standard\|rich\|deep]` | Catalog/code/history context budget for `/search` |
| `/sync [--schema …] [--table …]` | Sync DB structure / comments and cached code evidence into the catalog |
| `/rebuild` | Rebuild effective search state and the `amx_search` vector index |
| `/embeddings [kind] [model]` | Switch embedding provider (`MiniLM` / `OpenAI-compatible` / `Local`) |

### `/session` — Conversation sessions

| Command | Description |
|---|---|
| `/session new [--title]` | Start a fresh `/ask` session and pin it active |
| `/session list [-n N] [--all-profiles]` | Recent sessions with first-question excerpts |
| `/session resume <id>` | Switch active session pointer (refuses cross-profile resume) |
| `/session end` | Close the current session |
| `/session show [--id N] [--include-compacted]` | Per-turn audit trail |

### `/history` — Run history

| Command | Description |
|---|---|
| `/list [-n N]` | Recent runs (`Duration(s)` and `Model(s)`) |
| `/show <run_id>` | Full run JSON |
| `/stats` | Aggregate run/event statistics + search lifecycle counts |
| `/events [-n N]` | Recent app events (profile switches, run status, apply outcomes, …) |
| `/results <run_id>` | All saved LLM alternatives for a past run |
| `/review <run_id> [--unevaluated-only] [--apply]` | Re-evaluate saved alternatives interactively |
| `/compare [RUN_IDS…] [flags]` | Pivot runs side-by-side ([full flag list](history.md#compare)) |

### `/doctor` and `/usage`

| Command | Description |
|---|---|
| `/doctor` (or `amx doctor` from any shell) | Diagnose installation / config / connectivity |
| `/usage [window]` | Token + approximate-cost summary (`24h`, `7d` default, `30d`, `all`) |

See [Doctor](doctor.md) and [History → Usage](history.md#usage).

## Auto-namespace selection

When you run an unambiguous command from the root prompt, AMX picks the right namespace and
prints which one it assumed. Ambiguous commands ask. For scripts, prefer the explicit
namespace form (`/db connect` rather than `/connect`).

## Flags shared across commands

A handful of flags work on most run-shaped commands — see [Flags](flags.md):

- `--db-profile NAME`
- `--llm-profile NAME`
- `--code-profile NAME`
- `--doc-profile NAME`
- `--code-refresh`
- `--csv FILE` / `--md FILE` / `--json FILE` (where applicable)
- `--apply`
- `--actions` (on `/ask`)
- `--verbose` / `--debug` (on `/ask`)
