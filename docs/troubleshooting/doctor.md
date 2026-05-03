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

```text
✓ amx binary           /Users/jane/.venvs/amx/bin/amx (version 0.12.0)
```

The path of the `amx` you're running, plus version. **Multiple lines here means multiple
binaries on PATH** — pick one and uninstall the others.

```text
✓ python runtime       3.12.2 (/Users/jane/.venvs/amx/bin/python)
```

Python version + path. Warns on < 3.10.

```text
✓ config schema        v2 (matches binary expectation)
```

The schema version of `~/.amx/config.yml` vs what this binary expects. `Config schema too
new` means the binary is older than the config — upgrade. `Config schema too old` means
the opposite — AMX migrates on next save.

```text
✓ ~/.amx permissions   0o700, config.yml 0o600
```

Confirms the directory and config file modes are correct. Wrong modes warn — fix with
`chmod`.

```text
✓ DB profile           local_pg (postgresql 14.10)  — connection OK in 42ms
```

Real connection test against the **active** DB profile (not all profiles). For Databricks,
walks through saved profile → CA bundle from environment → `tls_no_verify` to find the
first working path.

```text
✗ DB profile           snow_prod (snowflake)
  → Missing driver. Install with:
        pip install "amx[snowflake]"
```

Active profile is selected but the driver isn't installed. Run the printed command.

```text
✓ LLM profile          openai_main (gpt-4o-mini)    — models endpoint OK
```

Confirms the API key is present and the provider's models endpoint responds. Skipped under
`--skip-network`.

```text
✓ History store        local mode, 247 runs persisted
```

Local SQLite is healthy. If shared mode is enabled, also reports outbox depth.

## Common failures and fixes

### `Multiple amx binaries on PATH`

Use a venv consistently. `which -a amx` shows you every binary; uninstall the ones you
don't want with `pip uninstall amx` from the offending Python.

### `Config schema too new`

```bash
pip install --upgrade amx
```

### `Missing driver`

Run the exact `pip install amx[<extra>]` from doctor's output.

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
