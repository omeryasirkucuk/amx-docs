# Changelog

For the complete release history, see [`CHANGELOG.md` in the AMX repository](https://github.com/omeryasirkucuk/amx/blob/main/CHANGELOG.md)
or the [GitHub Releases page](https://github.com/omeryasirkucuk/amx/releases).

The repo's CHANGELOG is generated from [Conventional Commits](https://www.conventionalcommits.org/)
by [`python-semantic-release`](https://python-semantic-release.readthedocs.io/).

## Latest highlights

### 0.12.9 — Multi-profile browse, `/ask`, and AMX Studio launch

AMX is multi-profile end-to-end. Both Studio and the CLI's `/ask` now
operate across every saved DB profile simultaneously — no more switch
dance.

**Browse (Studio).** The sidebar tree shows every saved DB profile as
its own expandable row (profile → database/catalog → schema → table).
Click any node to open it; per-request scope means two browser tabs
on different profiles never collide. The legacy "Switch" pill is
gone. Routes are explicit: `/db/:profile/:database/:schema/:table`
for 2-level backends and `/cat/:profile/:catalog/:schema/:table` for
3-level (Databricks UC, BigQuery). Inline comment editors and the
"Generate description" buttons all carry the per-page profile so the
write lands on the right backend.

**Multi-profile `/ask`.** Catalog tools span the configured profile
list in a single SQL pass via `db_profile IN (?, ?, …)`. Live-DB
tools (`list_schemas`, `list_tables_in_schema`, `list_databases`)
parallel-query each profile via `ThreadPoolExecutor` (cap 8 workers,
8s per-profile timeout — slow profile never blocks the others).
Result rows always carry `db_profile` so the LLM cites the right
source. New `find_joinable_across_profiles` tool scores
cross-DB join candidates with a 4-signal mix (column-name token
overlap, dtype compatibility, vector similarity, FK pattern) so
"what can I join this table with from a different DB?" is one tool
call away.

**Studio scope dropdown.** Above the Ask textarea: a multi-select
profile picker (sticky per chat session, resets on `+ New`) plus a
read-only "Focus: X (auto)" hint when the conversation has
gravitated toward one profile in recent turns. The auto-focus
heuristic scans the last 3 assistant turns; ≥60% mention dominance
biases the system prompt without locking out cross-profile
questions. Answer footer shows
`N profiles · X.Ys · focus: WAREHOUSE` per turn.

**CLI `/session` everywhere.** `/session list`, `/session resume <id>`,
`/session new`, `/session end`, `/session scope` now dispatch from
every tab (was previously failing inside `/search`). The slash
registry lists `/session` next to `/ask` under the search group.
Resumed chats now replay the prior 4 Q/A pairs into the agent so
follow-up references like "that table" / "the second one" resolve
without re-explaining context.

**Profile cleanup.** Deleting the active or last DB / LLM profile is
now allowed. Empty config surfaces a friendly "configure an LLM
profile" prompt (Studio: 412 + `configure-llm` hint with "Open LLM
settings" / "Run doctor" CTAs; CLI: `/search` discussion-requires-LLM
message).

**Robustness.**

- **Friendly LLM errors.** `/ask` no longer hangs on "Reasoning…"
  when the LLM is broken. Studio shows the configure-llm banner
  immediately on a missing provider/model (412 pre-flight); worker
  failures emit a `job.failed` SSE event with classification (auth /
  rate-limit / network / model-not-found → `configure-llm` hint;
  generic errors stay generic).
- **CLI Ctrl-C cancels cleanly.** First press sets a `cancel_token`
  the agent loop polls between iterations; second press also raises
  KeyboardInterrupt for stuck socket I/O. The chat surfaces "Cancelled
  by user." (Turkish: "Soru kullanıcı tarafından iptal edildi.")
  rather than draining the question to completion.
- **Last/active profile delete.** `/remove-db-profile` and
  `/remove-llm-profile` no longer refuse the only profile — config
  resets to empty, downstream surfaces handle it.
- **`list_databases` shows full reach.** Asking "which databases do
  I have" across two profiles now enumerates every reachable
  database/catalog per connection, not just the pinned default.
- **LiteLLM startup chatter silenced.** Corp-network TLS proxies no
  longer surface a "Failed to fetch remote model cost map" warning
  on every `/ask` — `LITELLM_LOCAL_MODEL_COST_MAP=True` skips the
  GitHub fetch entirely.

**AMX Studio launch.** The local web UI is **AMX Studio**. The slash
command is `/studio`, the Click subcommand is `amx studio`, and the
Python entry point is `amx.web.launch_studio`. The user-facing brand
(FastAPI title, browser tab, auth error messages, Settings copy) all
reads "AMX Studio." See the [Studio docs](cli/studio.md) for a full
walkthrough.

**`amx.core` Python library API cleanup (BREAKING).** `amx.init`,
`AMXApplication.ask_with_tools`, `LoopBasedAskAgent`, `AskToolbox`,
`ToolAskResponse`, `ToolResult`, `ReasoningTraceStep`, and
`infer_table_metadata` (free function) are removed. Use
`AMXApplication.load(...)`, `app.ask(...)`, and the new typed
`app.infer_metadata(schema, table, ...) -> list[InferenceResult]`
instead. See the migration block in the
[repo CHANGELOG](https://github.com/omeryasirkucuk/amx/blob/main/CHANGELOG.md#0129---2026-05-07).

**On-demand driver and dependency install.** Connecting to a new DB
backend (Snowflake, BigQuery, Databricks, MySQL, MS SQL, Trino,
Redshift, …) installs the driver on first connect; feature-gated
packages (RAG, codebase analysis, optional LLM provider SDKs)
auto-install on first use. The `pip install amx-cli[…]` extras still
work for reproducible environments.

### 0.12.8 — AMX Studio umbrella release

AMX Studio reaches feature parity with the REPL. Thirteen UI-overhaul PRs +
Stage 2–7 parity work + a design-system reset land together in 0.12.8: the SPA
can now drive `/run` end-to-end (with live SSE progress and a tabbed run-detail
view that surfaces every alternative), full DB / LLM / Docs / Code wizards live
on Settings, the new System page covers `amx doctor` / token usage / catalog
status / team history-store / one-click placeholder cleanup, and every Browse
page (database / schema / table / column) gets inline-edit + per-asset
**Generate** that drafts a single comment through the same human-in-the-loop
queue the CLI uses. AMX Studio is dark-only, sits on a warm-amber palette,
and ships under a pixel-art AMX brand mark. README and amxcli.com both grow a
[`/studio`](cli/studio.md) entry point with the Overview screenshot.

Also in 0.12.8: `Ctrl-C` now interrupts the running command instead of tearing
down the whole REPL session, and `/edit` "Bulk by table" respects mode selection
+ survives a stale catalog (live-DB fallback splices the user's pick back in).

### 0.12.7 — `databricks_serving` is a first-class LLM provider

`/add-llm-profile` now lists `databricks_serving` alongside OpenAI / Anthropic / Gemini
/ etc. Pick a Foundation Model endpoint (e.g.
`databricks-meta-llama-3-1-70b-instruct`, `databricks-dbrx-instruct`) or a custom
serving endpoint published in your workspace, paste the workspace host, paste a PAT —
done. AMX builds the `/serving-endpoints` URL for you. The big win: the LLM lives in
the same workspace as the SQL warehouse you're documenting, so there's no extra vendor
contract, no second authentication path, and inference cost stays on your existing
Databricks bill. See [Databricks Serving](llm-providers/databricks-serving.md) for the
full walkthrough.

Also fixed in 0.12.7: OpenAI Responses-style structured content blocks
(`{"type":"output_text",...}`) are flattened before pydantic validation, so reasoning
routes that emit content arrays no longer fail draft parsing.

### 0.12.6 — Databricks `/ask` polish + `list_volumes` tool

The Databricks experience for `/ask` is noticeably less wizard-y in 0.12.6:

- **Auto-pick the user catalog.** When the workspace has exactly one user-visible
  catalog (the common case for analyst sandboxes and team workspaces), `/ask` picks it
  silently instead of looping through a "select catalog" prompt for every question.
- **Catalog-scoped tools all auto-pick.** `list_schemas`, `list_tables`, `describe`,
  `sample` — every tool that needs a catalog now uses the same auto-pick logic, not
  just the first one.
- **`list_volumes` tool.** `/ask` can now answer questions about Unity Catalog
  Volumes ("what volumes exist?", "what's in `volume_x`?"), not just tables.
- **TLS asked first in `/db /add-db-profile`.** The wizard used to probe catalogs
  before knowing whether the workspace had custom TLS — corporate-CA setups would fail
  the probe and you'd have to start over. TLS now comes first, the catalog probe runs
  with the right truststore on the first try.

### 0.12.5 — `/edit-db-profile` + `/use-rag-llm` + safer profile writes

- **`/edit-db-profile`.** Edit an existing DB profile in place — same wizard as
  `/add-db-profile` but pre-fills with the current values, so press Enter to keep,
  type to change. Pairs with the existing collision-detection on `/add-db-profile`,
  which now points you at `/edit-db-profile` instead of failing.
- **`/use-rag-llm`.** Pin a different LLM profile to the RAG agent (the one that
  fuses documentation + codebase evidence into a description) than the one drafting
  columns. Useful when a cheaper fast model is enough for prose synthesis but you
  want a stronger model on the column-drafting path. Run with no args for an
  interactive picker, or `/use-rag-llm none` to clear the override.
- **Profile writes are transactional.** A bug where newly-created profiles could be
  silently empty after an `amx` restart (autosave running between two assignments
  with stale state) is fixed — `upsert_db_profile` + `set_active_db_profile` now run
  inside `cfg.transaction()` so save() sees consistent state.
- **Validating catalog/database picker.** The wizard now validates the
  catalog/database name against what the connection actually exposes, instead of
  taking the user's typo at face value and failing on the first query.
- **`/schema` and `/table` (singular) removed.** Use the plural `/schemas` and
  `/tables` (under the `/db` namespace) — they were the canonical commands all along
  and the singular forms were undocumented duplicates.

### 0.12.0 — `/doctor` streams staged progress like `/run`

`/doctor` (and the in-session `/doctor`) now print one `[Stage]` line per phase as
the check runs — `[Binary]`, `[Python]`, `[Schema]`, `[FS]`, `[Drivers]`, `[DB]`,
`[LLM]`, `[History]` — using the same live progress format `/run` uses. A stalled probe
(typically the LLM models-endpoint ping) is now visible as `in progress` for much longer
than its peers instead of looking like a hang, and the closing
`✓ /doctor finished in Xs. N passed, M failed.` summary mirrors `/run`'s footer with the
first remediation inline. Exit codes are unchanged (`0` clean, `1` if any ✗); under
`--skip-network` the `[LLM]` stage collapses to a single `skipped` line. See
[`/doctor`](cli/doctor.md) for the full sample output.

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
