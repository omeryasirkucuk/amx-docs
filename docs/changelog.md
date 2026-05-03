# Changelog

For the complete release history, see [`CHANGELOG.md` in the AMX repository](https://github.com/omeryasirkucuk/amx/blob/main/CHANGELOG.md)
or the [GitHub Releases page](https://github.com/omeryasirkucuk/amx/releases).

The repo's CHANGELOG is generated from [Conventional Commits](https://www.conventionalcommits.org/)
by [`python-semantic-release`](https://python-semantic-release.readthedocs.io/).

## Latest highlights

### 0.12.0 — docs aligned with interactive-only CLI

AMX is interactive-only: standalone shell subcommands (`amx doctor`, `amx setup`,
`amx /run …`, …) exit with `Direct subcommands are disabled. Start with amx, then run
slash commands inside the session`. The docs now consistently route every example
through `amx` followed by a slash command at the `>` prompt — installation, quickstart,
backend "Verify" steps, LLM-provider setup notes, env-var recipes, and the flag
reference all use the in-session form. Three new troubleshooting entries cover the
Windows `signal.SIGWINCH` startup regression (cross-platform fix incoming as a 0.12.x
patch), the shared-history-store `invalid literal for int() with base 10: ''` warning
that surfaces on `/analyze` listing schemas, and the current profile-editor input gaps
(reusing a profile name silently enters edit mode; host fields don't yet strip trailing
slashes or `https://` schemes).

### 0.12.0 — `/doctor` streams staged progress like `/run`

`/doctor` (the in-session diagnostics command) now prints one `[Stage]` line per phase as
the check runs — `[Binary]`, `[Python]`, `[Schema]`, `[FS]`, `[Drivers]`, `[DB]`,
`[LLM]`, `[History]` — using the same live progress format `/run` uses. A stalled probe
(typically the LLM models-endpoint ping) is now visible as `in progress` for much longer
than its peers instead of looking like a hang, and the closing
`✓ /doctor finished in Xs. N passed, M failed.` summary mirrors `/run`'s footer with the
first remediation inline. Under `--skip-network` the `[LLM]` stage collapses to a single
`skipped` line. See [`/doctor`](cli/doctor.md) for the full sample output.

### 0.12.0 — shared run-history store for team collaboration

AMX has always kept its run history in a single SQLite file at `~/.amx/history.db` — fine
for one engineer, invisible to teammates. 0.12.0 introduces an **optional shared mode**:
every `/run`, `/run-apply`, and `/ask` invocation is dual-written to a backend the team
already owns (PostgreSQL, MySQL, MSSQL, Oracle, Snowflake, Databricks, Redshift, or
BigQuery) under a dedicated `AMX` schema, so two engineers running AMX against the same
warehouse can finally see each other's analyses, results, and review decisions.

Onboarding is one command — `/history-store` (under the `/db` tab) opens an interactive
picker. See [Shared history store](collaboration/shared-history-store.md) for the full
walkthrough.

### 0.12.0 — six new database backends + extended object model

AMX now ships adapters for **MySQL, Oracle, SQL Server, Redshift, ClickHouse, and
DuckDB**, bringing the supported backend count to 10. Each adapter exposes the object
types its backend treats as first-class — not just tables and views. See
[Backends](backends/index.md) for the full capability matrix.

### 0.12.0 — Apache-2.0 license

AMX now ships under the Apache License, Version 2.0, replacing the previous MIT licence.
Apache-2.0 layers an explicit patent grant on top of the permissive redistribution terms
— a better fit for a tool that integrates with managed warehouses (Databricks, Snowflake,
BigQuery, Redshift) where downstream redistributors care about patent posture.

### 0.12.0 — `/temperature` slash command and wizard prompt

The LLM sampling temperature is now user-configurable from the interactive CLI instead of
being locked at the `0.2` default. The `/add-llm-profile` wizard prompts for it alongside
the existing generation settings, and `/temperature` shows or sets the value on the
active profile (e.g. `/temperature 0.7`). Values are clamped to `[0.0, 2.0]` and persist
to `~/.amx/config.yml`.

### 0.12.0 — `/search` improvements (selected)

- Live verification for high-risk structural claims uses deterministic read-only probe
  selection instead of a second LLM planning hop.
- Explicit table mentions take precedence over fuzzy catalog matches; AMX refuses to
  substitute similar candidates.
- Inventory and superlative questions answer with one fact, not a dump.
- Seven explicit answer shapes: `single_fact`, `short_table`, `full_table`, `ranked_list`,
  `table_summary`, `join_candidates`, `prose`.

See [`/ask` and `/search`](cli/ask-and-search.md) for the full feature surface.

### 0.12.0 — Reasoning-route token-budget fixes

- OpenRouter reasoning routes (kimi-k2-thinking, deepseek-reasoner, claude-sonnet-4 /
  opus-4 / 3.7-sonnet, o-series, gpt-5) now get the `AMX_LLM_MIN_MAX_TOKENS` floor
  (default 16384) so they don't burn the whole output budget on internal thinking.
- AMX sends `reasoning.effort` only — never with `reasoning.max_tokens` — because
  OpenRouter's API rejects that combination.
- Default `AMX_REASONING_EFFORT` for OpenRouter dropped from `medium` → `low` so token
  burn stays bounded by default.

### 0.12.0 — `/search` typo handling

Typo'd slash commands inside `/search` no longer silently become 30-second LLM calls.
Bare-text questions are still auto-prefixed with `/ask`, but explicit slash commands that
don't match anything print `Unknown command: /asl. Type /help.` like every other namespace.

## Following along

- `pip install --upgrade amx-cli` to update.
- The full changelog is in the [AMX repo CHANGELOG](https://github.com/omeryasirkucuk/amx/blob/main/CHANGELOG.md).
- Subscribe to [GitHub Releases](https://github.com/omeryasirkucuk/amx/releases) for tag
  notifications.
