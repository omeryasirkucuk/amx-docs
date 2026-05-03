# `amx doctor`

`amx doctor` is the diagnostics command. It runs from any shell — including a broken AMX
state — and reports actionable problems with your install, config, and connectivity.

## Why `doctor` is special

Every other AMX command requires a working install and config. `doctor` doesn't. If `amx`
won't start, `doctor` still tells you why. It's the first thing to run when something
looks wrong.

## Running it

```bash
amx doctor                    # full check, hits the network
amx doctor --skip-network     # offline quick check
```

You can also run it inside an AMX session as `/doctor`.

## What it checks

- **`amx` binaries on `PATH`.** Reports every `amx` it finds, with version. This catches the
  version-skew bug class — one `amx` in your global pip install, another in a project venv,
  and confusion about which one ran.
- **Python runtime.** Version + interpreter path. Warns on Python < 3.10.
- **Config schema version.** Reads `~/.amx/config.yml` and reports the schema version.
  Warns if it's older than the binary expects (suggesting an upgrade) or newer (raises
  `ConfigSchemaTooNewError` — downgrade or upgrade AMX).
- **Optional backend deps.** For each DB profile, checks whether the required extra
  (`amx[postgresql]`, `amx[snowflake]`, …) is installed. Missing extras print the exact
  `pip install` command to fix.
- **Active DB profile reachability.** Performs a real connection test (no LLM call). For
  Databricks, walks through saved profile → CA bundle from environment → `tls_no_verify`
  to find the first working path.
- **Active LLM profile reachability.** Confirms the API key is present (in keychain or
  config) and pings the provider's models endpoint. Skipped under `--skip-network`.
- **Filesystem.** Confirms `~/.amx/` exists, has the right permissions (`0o700`), and that
  `config.yml` is `0o600`.

## Sample output

```text
$ amx doctor
✓ amx binary           /Users/jane/.venvs/amx/bin/amx (version 0.12.0)
✓ python runtime       3.12.2 (/Users/jane/.venvs/amx/bin/python)
✓ config schema        v2 (matches binary expectation)
✓ ~/.amx permissions   0o700, config.yml 0o600
✓ DB profile           local_pg (postgresql 14.10)  — connection OK in 42ms
✓ LLM profile          openai_main (gpt-4o-mini)    — models endpoint OK
✗ DB profile           snow_prod (snowflake)
  → Missing driver. Install with:
        pip install "amx[snowflake]"
✓ History store        local mode, 247 runs persisted
```

## Interpreting failures

Each ✗ comes with a one-line remediation:

| Symptom | Hint |
|---|---|
| Multiple `amx` binaries on PATH | Use a venv consistently; remove the older install |
| `Missing driver` | Run the printed `pip install amx[<extra>]` |
| `Config schema too new` | Upgrade with `pip install --upgrade amx` |
| `CERTIFICATE_VERIFY_FAILED` (Databricks) | Set a Trusted CA file in the profile or `AMX_DATABRICKS_TRUSTED_CA_FILE` |
| `LLM models endpoint 401` | API key is wrong or rotated; re-run `/add-llm-profile` |
| `LLM models endpoint timeout` | Check egress proxy / firewall; retry with `--skip-network` to confirm everything else is fine |
| `Cannot read ~/.amx/config.yml` | File mode wrong, or you ran AMX as a different user previously |

## When to run it

- **Right after install.** Confirms you have everything the wizard needs.
- **After `pip install --upgrade amx`.** Catches schema bumps and missing extras.
- **When a `/run` fails for no obvious reason.** Doctor will tell you whether the LLM is
  reachable, whether the DB is reachable, and whether either changed since the last run.
- **In CI.** Run `amx doctor --skip-network` as a smoke test to confirm the installed
  bundle is intact.

## What `doctor` does NOT do

- It does not fix anything automatically. Every remediation is a printed command for you
  to run.
- It does not list every DB profile — only the **active** one is connection-tested. Use
  `/db inspect <profile>` for per-profile diagnosis.
- It does not modify `config.yml`. All checks are read-only.
