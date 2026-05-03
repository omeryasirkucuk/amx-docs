# Common errors

The error messages you're most likely to see, with the cause and fix for each.

## Install errors

### `AttributeError: module 'signal' has no attribute 'SIGWINCH'` on Windows

**Cause:** AMX's interactive REPL installs a terminal-resize handler so the prompt
redraws when you stretch the window. The current 0.12.0 launcher reaches for
`signal.SIGWINCH` unconditionally, but `SIGWINCH` only exists on POSIX — native Windows
Python doesn't expose it, so the launcher crashes during the splash banner:

```text
✗  AMX crashed: AttributeError: module 'signal' has no attribute 'SIGWINCH'
  File "…\amx\cli_support\session.py", line 1079, in run_interactive_session
    prev_sigwinch = signal.getsignal(signal.SIGWINCH)
```

**Fix:** This is a regression — the resize-handler should be feature-detected
(`if hasattr(signal, "SIGWINCH")`) so Windows skips it and the REPL still starts.
The patch is tracked for the next 0.12.x point release; `pip install --upgrade amx-cli`
once it ships and `amx` will start cleanly on Windows again. No platform-specific shell
is required.

### `ImportError: No module named 'psycopg2'` (or any other driver)

**Cause:** A database driver isn't importable. This usually means a broken or partial
install.

**Fix:** Reinstall AMX:

```bash
pip install --upgrade --force-reinstall amx
```

### `ConfigSchemaTooNewError: config schema v2 newer than this AMX (expects v1)`

**Cause:** `~/.amx/config.yml` was written by a newer AMX than the one currently
running. AMX refuses to load it rather than risk silently mangling.

**Fix:** `pip install --upgrade amx-cli`.

### `ConfigSchemaTooOldError`

**Cause:** Very old `~/.amx/config.yml`. AMX should auto-migrate, but if migration fails:

**Fix:** Back up the file, delete it, run `/setup` to rebuild.

## Connection errors

### `psycopg2.OperationalError: could not connect to server`

**Cause:** Postgres unreachable. Wrong host / port / firewall / not running.

**Fix:** `/doctor` (inside the AMX session) confirms the active profile is the one you
think it is. Verify with `psql -h <host> -p <port> -U <user> -d <database>` directly.

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

**Cause:** `/analyze /run` tests the active LLM **before** profiling any asset. The pre-flight
failed.

**Fix:** Run `/doctor` inside the AMX session. Usually it's an invalid API key or a
deactivated model.

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

**Fix:** Run `/llm` → `/add-llm-profile <name>`.

### `Could not verify table sap_s6p.adrc`

**Cause:** Explicit table mention in the question, but the live DB doesn't have that
table.

**Fix:** AMX **refuses to substitute a similar candidate** like `ADR6` — it shows fuzzy
matches as suggestions only. Either fix the question or accept one of the suggestions.

## Storage errors

### `disk I/O error` from SQLite

**Cause:** `~/.amx/history.db` is on a network filesystem with broken locking, or full
disk.

**Fix:** Move `~/.amx/` to a local filesystem (set `AMX_HOME`). Check `df -h`.

### `pending_shared_writes outbox depth: 142 — shared backend has been unreachable`

**Cause:** Shared mode dual-writes failed because the shared backend was unreachable.
Local writes still succeeded.

**Fix:** When the backend is back, `/db` → `/history-store` → **Flush pending** replays
the outbox.

### `Could not connect to shared history store; falling back to local-only. Underlying error: invalid literal for int() with base 10: ''`

**Cause:** The shared history store config has a port (or another integer field) saved
as an empty string — usually because the wizard was confirmed without entering a port,
or because the YAML was hand-edited and `port:` was left blank. AMX tries to coerce the
value with `int("")` and the connection setup raises before the driver is reached. The
same root cause also surfaces during `/analyze` as `✗ invalid literal for int() with
base 10: ''` on the `Listing schemas for asset scope` step, because that pipeline
re-touches the shared-store handle.

**Fix (workaround):** Either re-run the picker with an explicit port, or open
`~/.amx/config.yml` and set `port:` on the `history_store:` block to the backend's
default (`5432` Postgres, `3306` MySQL, `1433` MSSQL, `1521` Oracle, `5439` Redshift,
`9000` ClickHouse). Then restart `amx`:

```text
> /db
> /history-store      # re-runs the wizard; pick the existing backend and confirm port
```

If you don't need shared mode yet, disable it cleanly so the warning stops:

```text
> /db
> /history-store      # choose "disable" in the picker
```

Local-only mode keeps every `/run` and `/ask` working — only the cross-team dual-write
is paused.

## When you can't tell what's wrong

Inside the AMX session:

```text
> /doctor --skip-network            # offline check
> /doctor                           # full check
```

To collect a verbose log without re-running, tail it from a second shell:

```bash
tail -f ~/.amx/logs/amx.log         # live log
AMX_LOG=debug amx                   # raise log level for the next session
```

Then file an issue at <https://github.com/omeryasirkucuk/amx/issues> with the relevant
log excerpts (redact secrets), the output of `amx --version`, and the `/doctor` summary
copied from your session.
