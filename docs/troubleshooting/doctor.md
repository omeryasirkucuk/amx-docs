# Diagnostics with `amx doctor`

`amx doctor` is the first thing to run when something looks wrong. It runs from any shell
— including a broken AMX state — and reports actionable problems with your install,
config, and connectivity.

For the full reference see [`amx doctor`](../cli/doctor.md). This page is task-oriented:
"I see X — what does doctor tell me?"

## Quick reference

```bash
amx doctor                       # full check, hits the network
amx doctor --skip-network        # offline quick check
```

Inside an AMX session: `/doctor`.

## What each line means

`doctor` streams the same `[Stage]` progress lines that `/run` uses, so each check is
visible as it happens — a stalled probe (usually `[LLM]`) shows up as `in progress` for
much longer than the others rather than looking like a hang.

```text
[Binary]   scanning PATH for amx ......................  ok (0.0 s)
           /Users/jane/.venvs/amx/bin/amx (version 0.12.0)
```

The path of the `amx` you're running, plus version. **A second indented line under
`[Binary]` means a second `amx` on PATH** — pick one and uninstall the others.

```text
[Python]   detecting interpreter ......................  ok (0.0 s)
           3.12.2 (/Users/jane/.venvs/amx/bin/python)
```

Python version + path. Warns on < 3.10.

```text
[Schema]   reading ~/.amx/config.yml ..................  ok (0.1 s)
           v2 (matches binary expectation)
```

The schema version of `~/.amx/config.yml` vs what this binary expects. `Config schema too
new` means the binary is older than the config — upgrade. `Config schema too old` means
the opposite — AMX migrates on next save.

```text
[FS]       checking permissions on ~/.amx/ ............  ok (0.0 s)
           0o700, config.yml 0o600
```

Confirms the directory and config file modes are correct. Wrong modes warn — fix with
`chmod`.

```text
[Drivers]  importing backend drivers .................   in progress
           postgresql ................................   ok
           snowflake .................................   fail (missing)
```

One indented line per backend referenced in `config.yml`. Active profile is selected but
the driver isn't installed → run `pip install amx-cli`.

```text
[DB]       testing active profile local_pg ...........   in progress
           connect ...................................   ok (42 ms)
           handshake .................................   ok (postgresql 14.10)
```

Real connection test against the **active** DB profile (not all profiles). For Databricks,
walks through saved profile → CA bundle from environment → `tls_no_verify` to find the
first working path; each attempt prints its own indented line.

```text
[LLM]      pinging openai_main (gpt-4o-mini) ..........  in progress
           api key in keychain .......................   ok
           models endpoint ...........................   ok (218 ms)
```

Confirms the API key is present and the provider's models endpoint responds. Replaced by
`[LLM]      skipped (--skip-network) ..................   skipped` under `--skip-network`.

```text
[History]  inspecting local store .....................  ok (0.0 s)
           local mode, 247 runs persisted
```

Local SQLite is healthy. If shared mode is enabled, an extra indented line also reports
outbox depth (`pending_shared_writes: 0`).

```text
✓ /doctor finished in 0.9 s. 7 checks passed, 1 failed.
  Failed: backend driver — snow_prod (snowflake): missing
  → pip install amx-cli
```

Final summary mirrors `/run`'s footer: total elapsed time, pass/fail counts, and the first
remediation hint inline. `✓` means everything passed (exit `0`); `✗` means at least one
check failed (exit `1`) so CI can react.

## Common failures and fixes

### `Multiple amx binaries on PATH`

Use a venv consistently. `which -a amx` shows you every binary; uninstall the ones you
don't want with `pip uninstall amx` from the offending Python.

### `Config schema too new`

```bash
pip install --upgrade amx-cli
```

### `Missing driver`

Run the exact `pip install amx-cli` from doctor's output.

### `CERTIFICATE_VERIFY_FAILED`

Backend (usually Databricks) doesn't trust the corporate CA. Set
`tls_trusted_ca_file` on the profile, or set `AMX_DATABRICKS_TRUSTED_CA_FILE`. See
[TLS and proxies](../configuration/tls-and-proxies.md).

### `LLM models endpoint 401`

API key is wrong or rotated. Re-run `/add-llm-profile` for that profile and re-enter the
key.

### `LLM models endpoint timeout`

Network egress problem. Check proxy / firewall. Run `amx doctor --skip-network` to
confirm everything else is fine — if it does, the LLM endpoint is the only problem.

### `Cannot read ~/.amx/config.yml`

File mode wrong, or you previously ran AMX as a different user. `chmod 0600
~/.amx/config.yml` and `chmod 0700 ~/.amx/`.

### `History store: shared mode error`

Shared backend is unreachable. The `pending_shared_writes` outbox carries the failed
writes — when the backend is back, run `/db history-store` → **Flush pending**.

## When doctor isn't enough

Doctor only tests the **active** DB and LLM profile. To diagnose all profiles individually:

```text
/db inspect prod_pg
/db inspect snow_prod
/db inspect databricks-prod
```

`/db inspect` reports the backend, capabilities, connection test, visible schemas, and
table counts — without running any LLM agents.

For LLM profiles:

```text
/llm-profiles            # see all
/use-llm <name>          # switch
amx doctor               # test the new active one
```

## What doctor doesn't do

- Doesn't fix anything automatically. Every remediation is a printed command.
- Doesn't list every DB profile — only the **active** one is connection-tested.
- Doesn't modify `config.yml`. All checks are read-only.
