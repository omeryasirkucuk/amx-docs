# Quick start

This is the five-minute happy path. By the end you'll have an AMX install configured against
one database and one LLM, with a generated description ready to write back to the DB.

## 1. Install

```bash
pip install amx-cli
```

## 2. Open the interactive session

```bash
amx
```

You'll land in the AMX REPL. Slash commands drive everything from here.

## 3. Configure profiles

Run the first-time setup wizard:

```text
/setup
```

The wizard walks you through:

1. **Database connection.** Pick an engine (PostgreSQL, Snowflake, Databricks, BigQuery, …),
   then enter that engine's connection details. The profile is saved to `~/.amx/config.yml`.
2. **LLM provider.** Pick a provider (OpenAI, Anthropic, Gemini, …) and supply the API key.
   Keys are stored in the OS keychain when available.
3. **Optional data sources.** Document roots and codebase paths for the RAG and Code agents.
   You can skip these and add them later with `/add-doc-profile` and `/add-code-profile`.

Confirm everything is working:

```text
/config
/db
/connect
```

`/connect` performs a real connection test against the active DB profile.

## 4. Run the agents

```text
/run
```

`/run` opens a scope picker — Database / Schema / Asset — then dispatches the active agents
(Profile, RAG, Code) and merges their suggestions. Mid-flight you'll see live progress with
per-column status.

For a specific table:

```text
/run sap_s6p.t001
```

For multiple tables:

```text
/run t001 vbak
```

## 5. Review and apply

When the agents finish, `/run` opens its interactive review. First you choose a review
strategy — one-by-one, accept-all-high, accept-all, or reject-all. For each column you see:

- The top suggestion with confidence band (`high` / `medium` / `low`) and logprob score.
- A few alternatives.
- The evidence sources behind each suggestion (DB profile, code references, doc snippets).

When reviewing one-by-one, AMX presents a numbered picker: type a number to pick a
description, `s` to skip, or `o` to write your own text.

When you're done reviewing, write back to the database:

```text
/apply
```

## 6. Inspect what happened

```text
/history list
/history show <run_id>
/usage 7d
```

`/history list` shows recent runs with duration and model. `/history show` dumps the full
JSON payload (scope, metrics, tokens, results, errors). `/usage` summarises token usage
over a window.

## When something goes wrong

Open AMX and run `/doctor`:

```bash
amx
```

```text
> /doctor
```

`/doctor` diagnoses install / config / connectivity and prints actionable hints next to
each ✗.

For the full review experience and a real example, continue with the [first run walkthrough](first-run.md).
