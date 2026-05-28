# Common errors

The error messages you're most likely to see, with the cause and fix for each.

## Install errors

### `ImportError: No module named 'psycopg2'` (or any other driver)

**Cause:** A database driver isn't importable. This usually means a broken or partial
install.

**Fix:** Reinstall AMX:

```bash
pip install --upgrade --force-reinstall amx-cli
```

### `ConfigSchemaTooNewError: config schema v2 newer than this AMX (expects v1)`

**Cause:** `~/.amx/config.yml` was written by a newer AMX than the one currently
running. AMX refuses to load it rather than risk silently mangling.

**Fix:** `pip install --upgrade amx-cli`.

## Connection errors

### `psycopg2.OperationalError: could not connect to server`

**Cause:** Postgres unreachable. Wrong host / port / firewall / not running.

**Fix:** `/doctor` confirms the active profile is the one you think it is. Verify with
`psql -h <host> -p <port> -U <user> -d <database>` directly.

### `snowflake.connector.errors.OperationalError: 250001 — Could not connect to Snowflake backend`

**Cause:** Wrong account locator, wrong region in the account, or network egress blocked.

**Fix:** Verify the account locator format (`xy12345.eu-west-1` includes the region for
non-US accounts). Test from a different network if you suspect egress.

### `databricks.sql.exc.RequestError: CERTIFICATE_VERIFY_FAILED`

**Cause:** Corporate proxy or private CA in the chain.

**Fix:** Set `tls_trusted_ca_file` on the Databricks profile, or set
`AMX_DATABRICKS_TRUSTED_CA_FILE`. See
[Databricks](../backends/databricks.md) and [TLS and proxies](../configuration/tls-and-proxies.md).

### `pyodbc.Error: Data source name not found and no default driver specified`

**Cause:** SQL Server requires the **ODBC Driver 18 for SQL Server** at the OS level. The
Python package isn't enough.

**Fix:** Install Microsoft's ODBC Driver 18 — see Microsoft's
[install guide](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server).

### `oracledb.DatabaseError: ORA-12541: TNS:no listener`

**Cause:** Wrong port or Oracle listener not running.

**Fix:** Default port is `1521`. Verify with `tnsping <service_name>` if you have the
Oracle client locally.

### `bigquery.exceptions.NotFound: Dataset … not found`

**Cause:** Dataset doesn't exist or service account lacks `bigquery.datasets.get`.

**Fix:** Confirm `project` and `dataset` in the profile. Grant `BigQuery Data Viewer` on
the dataset.

## LLM errors

### `LLM not reachable — refusing to start /run`

**Cause:** `/run` tests the active LLM **before** profiling any asset. The pre-flight
failed.

**Fix:** Run `/doctor`. Usually it's an invalid API key or a deactivated model.

### `Model returned 0 visible characters and used all 900 output tokens`

**Cause:** Reasoning model burned its output budget on internal thinking.

**Fix:** AMX auto-raises `max_tokens` to 16384 for recognised reasoning routes. If your
model isn't recognised, force the floor explicitly:

```bash
export AMX_LLM_MIN_MAX_TOKENS=16384
```

For OpenRouter, also drop the effort:

```bash
export AMX_REASONING_EFFORT=low
```

### `litellm.BadRequestError: OpenrouterException — Only one of "reasoning.effort" and "reasoning.max_tokens" can be specified`

**Cause:** OpenRouter rejects the two reasoning kwargs together. AMX 0.12+ sends `effort`
only.

**Fix:** Upgrade to AMX 0.12 or later.

### `finish_reason=length`

**Cause:** Prompt + expected output exceeded `max_tokens`. AMX never silently parses
truncated JSON — the run halts.

**Fix:** Reduce `/llm-batch-size`, drop `/n-alternatives` to 1, switch `/prompt-detail` to
`minimal`, or raise `max_tokens` if the provider supports it.

### `Provider refusal — content filter triggered`

**Cause:** Anthropic / Gemini's safety filter blocked a prompt for a column that sounded
medical / legal / adult.

**Fix:** Review surfaces these as `skipped — provider refusal`. You can re-evaluate later
with `/history review` against a different model that doesn't refuse.

## `/run` errors

### `Permission denied for table sap_s6p.t001`

**Cause:** AMX role lacks `SELECT` on the table.

**Fix:** Grant `SELECT`. AMX errors with the exact backend message; the message tells you
which role/grant is missing.

### `Backend profiling failure — column-level stats unavailable`

**Cause:** A single column's stats query failed (often a permission issue on a system
view).

**Fix:** AMX skips that column's expensive stats and keeps making progress. The run
completes; the failed column shows lower confidence than usual. The error text appears in
`/history show <run_id>`.

### `MaxRowsExceeded: profiling_max_rows … table has X rows`

**Cause:** `full` mode would scan a very large table; AMX falls back to lightweight
metadata + samples instead. Not actually an error — it's a notice.

**Fix:** Either accept the lightweight signal or switch profile to `sampled` mode
explicitly.

## `/apply` errors

### `Insufficient privilege for COMMENT ON COLUMN`

**Cause:** The DB role can `SELECT` but cannot `COMMENT`.

**Fix:** Grant the appropriate write privilege (varies by backend — see the per-backend
page). Or use a separate write profile via `--db-profile`.

### `Schema comments unsupported on this backend`

**Cause:** You tried to apply a schema-level comment on MySQL, DuckDB 1.x, or BigQuery
project-level — none of which support it.

**Fix:** AMX raises clearly rather than silently no-op'ing. Drop the schema-level
description or move it to a table-level comment.

## `/ask` errors

### `No active LLM profile — refusing to ask`

**Cause:** `/ask` fails closed when no LLM is configured.

**Fix:** Run `/llm` → `/add-llm-profile <name>`. In Studio, the same scenario
shows a "Couldn't reach the LLM" banner with **Open LLM settings** and
**Run doctor** CTAs above the chat textarea — that's the
`configure-llm` hint surfacing as UI rather than a generic error toast.

### `/ask` hangs on "Reasoning…" forever

**Cause:** Older AMX builds didn't surface LLM-init failures as a terminal SSE
event, so a misconfigured provider (missing API key, bad model id, network
down to the provider, expired token) drained the worker without ever telling
the SPA the question failed.

**Fix:** Upgrade to 0.12.9 or newer — the `/ask` path classifies LLM-side
errors (auth, rate limit, model-not-found, network/DNS) and emits a clean
`job.failed` SSE event with a `configure-llm` hint. The chat now surfaces
"Couldn't reach the LLM. Check your provider settings…" instead of leaving
the bubble at "Reasoning…". On the CLI, the same scenario returns a friendly
"Cancelled by user." or surfaces the LiteLLM error string verbatim.

### Pressing <kbd>Ctrl-C</kbd> in CLI `/ask` doesn't stop the question

**Cause:** Older builds let the LLM HTTP call drain to completion before
Python's default `KeyboardInterrupt` could reach the user — the first press
felt ignored.

**Fix:** Upgrade to 0.12.9+. The CLI installs a temporary SIGINT handler for
the duration of `/ask` that sets a `cancel_token` the agent loop polls between
iterations (graceful exit within a tool / LLM step). A second press also
raises `KeyboardInterrupt` so any blocked socket I/O eventually terminates.

### `Could not verify table sap_s6p.adrc`

**Cause:** Explicit table mention in the question, but the live DB doesn't have that
table.

**Fix:** AMX **refuses to substitute a similar candidate** like `ADR6` — it shows fuzzy
matches as suggestions only. Either fix the question or accept one of the suggestions.

## Storage errors

### `disk I/O error` from SQLite

**Cause:** `~/.amx/history.db` is on a network filesystem with broken locking, or full
disk.

**Fix:** Move `~/.amx/` to a local filesystem (set `AMX_CONFIG_DIR`). Check `df -h`.

### `pending_shared_writes outbox depth: 142 — shared backend has been unreachable`

**Cause:** Shared mode dual-writes failed because the shared backend was unreachable.
Local writes still succeeded.

**Fix:** When the backend is back, `/db` → `/history-store` → **Flush pending** replays
the outbox.

## When you can't tell what's wrong

Inside the AMX REPL:

```text
> /doctor --skip-network             # offline check
> /doctor --debug                    # verbose, every probe traced
```

Outside the REPL:

```bash
tail -f ~/.amx/logs/amx.log          # live log
AMX_LOG_LEVEL=DEBUG amx              # restart AMX with verbose logging
```

Then file an issue at <https://github.com/omeryasirkucuk/amx/issues> with the relevant
log excerpts (redact secrets) and the output of `amx --version` plus `/doctor`.
