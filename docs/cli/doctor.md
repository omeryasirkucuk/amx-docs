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
- **Backend driver availability.** For each DB profile, checks whether the required
  database driver is importable. Missing drivers print a remediation hint.
- **Active DB profile reachability.** Performs a real connection test (no LLM call). For
  Databricks, walks through saved profile → CA bundle from environment → `tls_no_verify`
  to find the first working path.
- **Active LLM profile reachability.** Confirms the API key is present (in keychain or
  config) and pings the provider's models endpoint. Skipped under `--skip-network`.
- **Filesystem.** Confirms `~/.amx/` exists, has the right permissions (`0o700`), and that
  `config.yml` is `0o600`.

## Sample output

`doctor` streams each check as it runs — one `[Stage]` line per phase, the same live
progress format `/run` uses — so a stalled probe (typically the LLM ping) is obvious
instead of looking like a hang. The final line summarises pass/fail counts and points at
the first remediation:

```text
$ amx doctor
[Binary]   scanning PATH for amx ......................  ok (0.0 s)
           /Users/jane/.venvs/amx/bin/amx (version 0.12.0)
[Python]   detecting interpreter ......................  ok (0.0 s)
           3.12.2 (/Users/jane/.venvs/amx/bin/python)
[Schema]   reading ~/.amx/config.yml ..................  ok (0.1 s)
           v2 (matches binary expectation)
[FS]       checking permissions on ~/.amx/ ............  ok (0.0 s)
           0o700, config.yml 0o600
[Drivers]  importing backend drivers .................   in progress
           postgresql ................................   ok
           snowflake .................................   fail (missing)
[DB]       testing active profile local_pg ...........   in progress
           connect ...................................   ok (42 ms)
           handshake .................................   ok (postgresql 14.10)
[LLM]      pinging openai_main (gpt-4o-mini) ..........  in progress
           api key in keychain .......................   ok
           models endpoint ...........................   ok (218 ms)
[History]  inspecting local store .....................  ok (0.0 s)
           local mode, 247 runs persisted
✗ /doctor finished in 0.9 s. 7 checks passed, 1 failed.
  Failed: backend driver — snow_prod (snowflake): missing
  → pip install amx-cli
```

Under `--skip-network` the `[LLM]` stage is replaced by a single
`[LLM]      skipped (--skip-network) ..................   skipped` line and the timer
typically falls under 0.3 s. A clean run finishes with `✓ /doctor finished` and exits
with code `0`; any ✗ check exits with `1` so it slots cleanly into CI smoke tests.

## Interpreting failures

Each ✗ comes with a one-line remediation:

| Symptom | Hint |
|---|---|
| Multiple `amx` binaries on PATH | Use a venv consistently; remove the older install |
| `Missing driver` | Run the printed `pip install amx-cli` |
| `Config schema too new` | Upgrade with `pip install --upgrade amx-cli` |
| `CERTIFICATE_VERIFY_FAILED` (Databricks) | Set a Trusted CA file in the profile or `AMX_DATABRICKS_TRUSTED_CA_FILE` |
| `LLM models endpoint 401` | API key is wrong or rotated; re-run `/add-llm-profile` |
| `LLM models endpoint timeout` | Check egress proxy / firewall; retry with `--skip-network` to confirm everything else is fine |
| `Cannot read ~/.amx/config.yml` | File mode wrong, or you ran AMX as a different user previously |

## When to run it

- **Right after install.** Confirms you have everything the wizard needs.
- **After `pip install --upgrade amx-cli`.** Catches schema bumps and missing extras.
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
