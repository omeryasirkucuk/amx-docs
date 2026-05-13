# CLI overview

AMX is **interactive-first**. You start a session with `amx`, then drive everything
through slash commands inside the REPL — no shell pipelines, no flag soup. This page
covers the namespace structure, how to discover commands inline, and the muscle-memory
shortcuts that make day-to-day use fast.

## Prerequisites

- AMX installed (`pip install amx-cli`).
- A terminal that supports ANSI colors (any modern terminal is fine).

## Step-by-step

### 1. Open the REPL

```bash
amx
```

You land in the AMX session:

```text
            █████╗ ███╗   ███╗██╗  ██╗
           ██╔══██╗████╗ ████║╚██╗██╔╝
           ███████║██╔████╔██║ ╚███╔╝
           ██╔══██║██║╚██╔╝██║ ██╔██╗
           ██║  ██║██║ ╚═╝ ██║██╔╝ ██╗
           ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝

  AMX 0.14.0 · LLM profile: openai-prod · 4 DB profiles configured
  Type /help for commands, /exit to quit.

>
```

The header line tells you the active LLM profile and how many DB
profiles are configured — DB profiles are no longer "active vs.
inactive", every saved profile is available to every command (and to
both Studio sidebar tabs) at the same time. Pass an explicit
`--db-profile` to commands that need a specific one, or use the
multi-profile scope picker in `/run` and `/ask`. If the LLM profile
says `none`, run `/setup` (first time) or `/use-llm <name>`.

### 2. Discover commands

Two interactive ways to learn the command surface:

```text
> /help
Top-level commands:
  /setup         First-time wizard for DB + LLM profiles
  /db            Database profile and connection management
  /llm           LLM profile management
  /docs          Document-source management (RAG)
  /code          Code-source management
  /metadata      Inspect introspection output
  /run           Run agents on a scope
  /generate      Single-shot draft for one asset address
  /rerun         Re-execute one or many run_results rows with original context
  /apply         Write reviewed comments back to the DB
  /max-tokens    Show or set the per-call output budget on the active LLM profile
  /search        Catalog search, embedding rebuild, and chat sessions
  /session       Manage /ask conversation sessions (list / resume / new / end / scope)
  /studio        Boot AMX Studio (local web UI) on 127.0.0.1
  /history       Audit trail and run comparison
  /doctor        Diagnostics
  /config        Show or edit ~/.amx/config.yml
  /restore-config  Recover ~/.amx/config.yml from a rotated backup
  /help, /exit, /clear, /back, /save
```

```text
> /db
Database namespace:
  /db-profiles            List configured DB profiles
  /add-db-profile         Wizard to register a new profile
  /edit-db-profile <name> Re-run the wizard pre-filled with current values
  /remove-db-profile      Delete a profile
  /connect <name>         Test connection for a specific profile
  /schemas <name>         List schemas in a profile
  /tables <name> <schema> List tables in a schema
  /profile <table>        Run profiling-only on one table
  /inspect <name>         Server-side counts and stats for a profile
  /history-store          Configure shared history store
  /cleanup-placeholders   Clean stale review-queue rows
```

Each top-level letter (e.g. `/d`, `/r`) tab-completes the command name; arrow keys walk
your previous commands.

### 3. Use the namespace shortcuts

Slash commands are **flat** — `/use-db` works at the root prompt, you don't need to
"enter" the `/db` namespace first. But typing `/db` *does* drop you into a sub-prompt
where every command is implicitly under `/db`:

```text
> /db
[db]> profiles
default        prod-pg          dev-snowflake
[db]> use-db prod-pg
✓ Active DB profile → prod-pg
[db]> /back
>
```

Use this when you're doing a lot of DB-related work in a row and want shorter typing.
`/back` (or `Ctrl-D`) returns to the root.

### 4. Save and resume sessions

```text
> /save
✓ Session saved: ~/.amx/sessions/2026-05-03_15-42.amxsession

# Later, in a new shell:
amx --resume 2026-05-03_15-42
```

Session save captures the active profiles, current scope (last `/run` table list), and
the in-memory review queue — so you can step away from a half-reviewed run and pick up
exactly where you left off.

### 5. Get unstuck

When something doesn't work, the order of escalation is:

```text
> /doctor
✓ AMX version — 0.14.0 (config schema v2)
✓ Python runtime — 3.11.5
✓ DB profiles — 4 configured (prod-pg, dev-snowflake, reporting, sandbox)
✓ Active LLM profile — openai-prod [openai] gpt-4o
✓ Reachable
```

If all checks pass but a specific command fails, re-run with `/run --debug` (or any
command's `--debug` flag) for verbose tracing. See [Common errors](../troubleshooting/common-errors.md)
for the most-frequently-seen failures.

## The full namespace tree

Every user-facing command in the CLI is grouped by namespace below. Tabs *group*
related commands for discovery — routing is global, so any command dispatches
from any tab. `/session list` typed inside `/db` works exactly the same as from
the root prompt.

### Root commands

| Command | Purpose |
|---|---|
| `/setup` | First-run wizard for DB + LLM (+ optional doc/code) profiles |
| `/config` | Show or edit `~/.amx/config.yml` |
| `/studio` | Launch AMX Studio (local web UI on `127.0.0.1`). Flags: `--port`, `--no-open` |
| `/doctor` | Diagnostics. Flags: `--skip-network`, `--debug` |
| `/restore-config` | Recover `~/.amx/config.yml` from a rotated backup. Flags: `--list`, `--from <path>` |
| `/help`, `/exit`, `/clear`, `/back`, `/save` | REPL built-ins |

### `/db` — database profiles, connections, introspection

| Command | Purpose |
|---|---|
| `/db-profiles` | List configured DB profiles |
| `/add-db-profile` | Wizard to register a new profile |
| `/edit-db-profile [<name>]` | Re-run the wizard pre-filled with current values |
| `/remove-db-profile <name>` | Delete a profile |
| `/use-db <profile> [<profile>…]` | Switch active DB scope; accepts multiple profiles for multi-profile `/ask`, `/run`, `/sync` |
| `/connect` | Test connectivity for the active profile (Databricks: triggers Unity Catalog picker) |
| `/schemas` | List schemas reachable in the active profile |
| `/tables [<schema>]` | List tables/views/materialized views in a schema |
| `/profile [<schema>] [<table>]` | Profile a single table (stats, types, samples) |
| `/inspect [<profile>]` | Full backend diagnostic (capabilities, visible schemas, table counts) |
| `/profiling [full\|sampled\|metadata] [max_rows] [sample_size]` | Configure profiling guardrails per profile |
| `/tls [on\|off] [ca_path\|clear]` | Show / configure Databricks TLS settings |
| `/history-store` | Configure shared run-history backend (`status`, `enable`, `disable`, `migrate-from-local`, `flush-pending`, `dump-ddl`) |
| `/cleanup-placeholders [<schema>]` | Remove auto-inference placeholder comments from the live DB |
| `/cache-show [--profile=X] [--database=Y]` | Display the metadata cache contents |
| `/cache-stats` | Aggregate cache metrics (rows, oldest fetch, % expired) |
| `/cache-clear [--profile=X] [--database=Y] [--type=schemas\|columns\|catalog\|all] [--force]` | Flush cache rows |

### `/llm` — LLM profiles and tuning

| Command | Purpose |
|---|---|
| `/llm-profiles` | List configured LLM profiles |
| `/use-llm <name>` | Switch the active LLM profile |
| `/use-rag-llm [<name>\|none]` | Pin a different LLM profile to the RAG agent (or clear the override) |
| `/add-llm-profile` | Wizard to register a new LLM profile |
| `/remove-llm-profile <name>` | Delete an LLM profile |
| `/temperature [0.0–2.0]` | Show / set sampling temperature on the active profile |
| `/max-tokens [N]` | Show / set output-token budget (reasoning models keep their 32 768 floor) |
| `/n-alternatives [1–5]` | Number of alternative descriptions per column |
| `/prompt-detail [minimal\|standard\|detailed\|full]` | System-prompt detail level |
| `/description-verbosity [brief\|detailed\|comprehensive\|exhaustive]` | Output description length |
| `/logprob-thresholds [high] [med]` | Confidence thresholds (defaults: high=0.85, medium=0.50) |
| `/llm-batch-size [N]` | Columns per LLM call |
| `/batch-context-columns [off\|all\|N]` | Extra non-batch column names to include in each batch |
| `/cost [<input> <output>\|reset]` | Override per-1M-token cost for the active profile |
| `/refresh-prices` | Re-fetch LLM pricing from LiteLLM + OpenRouter (24 h cache) |
| `/style [wizard\|set\|show\|clear\|on\|off]` | Reference-table attachment for description style matching |

### `/docs` — document sources for RAG

| Command | Purpose |
|---|---|
| `/doc-profiles` | List configured doc profiles |
| `/doc-files [<name>]` | Show files staged under a profile |
| `/use-doc <name>` | Switch the active doc profile |
| `/add-doc-profile` | Create / update a doc profile |
| `/remove-doc-profile <name>` | Delete a doc profile |
| `/doc-link <doc-profile> [--db NAME…] [--clear]` | Link a doc profile to one or more DB profiles |
| `/doc-add <profile> <file>… [--no-ingest]` | Copy files into `~/.amx/uploads/<profile>/` |
| `/scan [--doc-profile NAME] [paths…]` | Scan documents into the index |
| `/ingest [--doc-profile NAME] [--refresh] [paths…]` | Ingest scanned documents (embed + persist) |
| `/search-docs <text>` | Similarity search over the doc index (no LLM, embedding-only) |
| `/doc-analyze [TABLE…]` | Run the RAG agent standalone |
| `/export-doc-report [FILE]` | Export a doc-RAG summary to Markdown |

### `/code` — codebase sources for RAG

| Command | Purpose |
|---|---|
| `/code-profiles` | List configured code profiles |
| `/use-code <name>` | Switch the active code profile |
| `/add-code-profile` | Create / update a code profile |
| `/remove-code-profile <name>` | Delete a code profile |
| `/code-link <code-profile> [--db NAME…] [--clear]` | Link a code profile to one or more DB profiles |
| `/code-scan [path] [--code-profile NAME]` | Scan a codebase and persist the index |
| `/code-search <text> [--code-profile NAME]` | Similarity search over the code index |
| `/code-refresh` | Clear cache + rebuild the semantic code index |
| `/code-results` | Show last cached scan results |
| `/code-analyze [TABLE…]` | Run the Code Agent standalone |
| `/export-code-report [FILE]` | Export the scan report to Markdown |

### `/metadata` — universal metadata editing

| Command | Purpose |
|---|---|
| `/inspect [<schema>] [<table>]` | Inspect current metadata |
| `/monitor [<schema>]` | Show metadata coverage |
| `/edit [db][.schema[.table[.column]]]` | Edit wizard, or direct path editor |

`/manual` is an alias for `/metadata`.

### `/analyze` — runs, apply, schedules

| Command | Purpose |
|---|---|
| `/run [ASSET…] [--schema…] [--apply] [--db-profile NAME…]` | Run agents over a scope (database / schema / asset / column) |
| `/run-apply [ASSET…] [--schema…] [--table…]` | Run + apply in one shot |
| `/apply` | Write pending comments to the database |
| `/generate <address>` | Single-shot draft for one asset address |
| `/rerun <run_id>[.schema.table.column]` | Re-execute a result row with original scope, profile cache, and prompt detail preserved |
| `/review [<run_id>] [--filter REGEX] [--sort KEY] [--group-by schema\|table] [--only-unreviewed] [--only-low-conf]` | Review suggestions with filtering / sorting |
| `/schedule add\|list\|show\|pause\|resume\|rm\|run-now\|tick\|status\|install-daemon\|uninstall-daemon` | Scheduled-run management |

### `/search` — catalog search, sessions, evidence

| Command | Purpose |
|---|---|
| `/ask` | Ask a metadata question (supports `--db-profile NAME` for multi-DB, `--actions` for follow-up execution) |
| `/session list\|resume <id>\|new\|end\|scope [profiles]` | Manage `/ask` conversation sessions |
| `/status` | Show catalog / index status |
| `/sources` | Show evidence sources and settings |
| `/ask-context` | Show which doc / code profiles `/ask` will use for the current DB scope |
| `/config [key] [value]` | Show / set search-scoped config |
| `/embeddings [minilm\|openai\|local] [model]` | Show / change the embedding provider |
| `/sync [--db-profile NAME…]` | Sync DB structure / comments and code evidence into the index |
| `/rebuild` | Rebuild search state and vector index |
| `/find-columns` | Find columns by name / pattern |
| `/join-candidates` | Find joinable tables across profiles |
| `/explain` | Explain an entity |
| `/explain-table` | Explain a table |

### `/history` — runs, results, comparison

| Command | Purpose |
|---|---|
| `/list [-n N] [--include-asks]` | List recent runs |
| `/show <run_id>` | Show one run payload |
| `/stats` | Aggregate run / event metrics |
| `/events [-n N]` | Recent app events |
| `/results <run_id>` | Show saved LLM alternatives |
| `/review <run_id> [--unevaluated-only] [--apply]` | Re-evaluate alternatives |
| `/rollback <run_id>` | Undo an `/apply`, restoring the prior comment text |
| `/compare [--last N] [run_ids…] [--schema SCHEMA] [--table TABLE] [--by DIMENSION]` | Compare past runs side-by-side |

## Verify

1. `> /help` — full command list, grouped by namespace.
2. `> /db` then `>back` — confirms namespace navigation works.
3. `> /doctor` — confirms profiles activate and reach their endpoints.

## What's next

- [Quick start](../getting-started/quickstart.md) — five-minute walkthrough using PostgreSQL + OpenAI.
- [Run & Apply](run-and-apply.md) — the heart of the workflow: `/run`, review wizard, `/apply`.
- [Setup wizard](setup.md) — first-time `/setup` walkthrough.
- [`/analyze schedule`](schedules.md) — one-shot scheduled metadata runs and daemon controls.
- [`/restore-config`](restore-config.md) — recover `~/.amx/config.yml` from a rotated backup.
- [`/studio`](studio.md) — same workflow on a local web UI (AMX Studio) when you'd rather see everything at once.
