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

  AMX 0.12.0 · Active DB profile: prod-pg · Active LLM profile: openai-prod
  Type /help for commands, /exit to quit.

>
```

The header line tells you, at a glance, which DB and LLM profile your next command will
use. If either says `none`, run `/setup` (first time) or `/use-db` / `/use-llm`.

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
  /apply         Write reviewed comments back to the DB
  /search        Catalog search and embedding rebuild
  /history       Audit trail and run comparison
  /doctor        Diagnostics
  /config        Show or edit ~/.amx/config.yml
  /help, /exit, /clear, /back, /save
```

```text
> /db
Database namespace:
  /db-profiles            List configured DB profiles
  /use-db <name>          Set the active DB profile
  /add-db-profile         Wizard to register a new profile
  /remove-db-profile      Delete a profile
  /connect                Test the active connection
  /schemas                List schemas in the active DB
  /tables <schema>        List tables in a schema
  /profile <table>        Run profiling-only on one table
  /inspect                Server-side counts and stats
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
✓ AMX version — 0.12.0 (config schema v7)
✓ Python runtime — 3.11.5
✓ Active DB profile — prod-pg [postgresql] db-prod.../analytics
✓ Active LLM profile — openai-prod [openai] gpt-4o
✓ Reachable
```

If all checks pass but a specific command fails, re-run with `/run --debug` (or any
command's `--debug` flag) for verbose tracing. See [Common errors](../troubleshooting/common-errors.md)
for the most-frequently-seen failures.

## The full namespace tree

| Namespace | Purpose | Sub-commands (subset) |
|---|---|---|
| `/setup` | First-run wizard for DB + LLM | — |
| `/config` | Show or edit `~/.amx/config.yml` | — |
| `/db` | Connection & introspection | `profiles`, `add-db-profile`, `use-db`, `connect`, `schemas`, `tables`, `profile`, `inspect`, `history-store` |
| `/llm` | LLM profile management | `profiles`, `add-llm-profile`, `use-llm`, `temperature`, `n-alternatives`, `logprob-thresholds`, `description-verbosity` |
| `/docs` | RAG document sources | `doc-profiles`, `add-doc-profile`, `scan`, `ingest`, `search-docs`, `doc-analyze` |
| `/code` | Codebase scan + RAG | `code-profiles`, `code-scan`, `code-analyze` |
| `/metadata` | Inspect introspection cache | — |
| `/analyze` | Run + apply | `/run`, `/run-apply`, `/apply` |
| `/search` | Catalog search | `/ask`, `/status`, `/sync`, `/rebuild` |
| `/history` | Audit trail + comparison | `list`, `show`, `stats`, `events`, `results`, `review`, `compare` |
| `/doctor` | Diagnostics | `--skip-network`, `--debug` |

## Verify

1. `> /help` — full command list, grouped by namespace.
2. `> /db` then `>back` — confirms namespace navigation works.
3. `> /doctor` — confirms profiles activate and reach their endpoints.

## What's next

- [Quick start](../getting-started/quickstart.md) — five-minute walkthrough using PostgreSQL + OpenAI.
- [Run & Apply](run-and-apply.md) — the heart of the workflow: `/run`, review wizard, `/apply`.
- [Setup wizard](setup.md) — first-time `/setup` walkthrough.
