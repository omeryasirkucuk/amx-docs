# Security policy

The canonical source of this policy is [SECURITY.md in the AMX repo](https://github.com/omeryasirkucuk/amx/blob/main/SECURITY.md).
This page mirrors it for discoverability.

## Reporting a vulnerability

If you believe you have found a security issue in AMX, please **do not open a public
GitHub issue**. Instead, report it privately so we have time to investigate and ship a fix
before details are public.

- **Preferred:** open a [private security advisory](https://github.com/omeryasirkucuk/amx/security/advisories/new)
  on the repository.
- **Alternative:** email <omeryasirkucuk@gmail.com> with the subject
  `AMX security: <short summary>`.

Please include:

- A description of the issue and the impact you believe it has.
- Steps to reproduce, or a minimal proof of concept.
- The AMX version (`amx --version`), Python version, and OS.
- Whether the issue is already public anywhere.

We will acknowledge receipt within 5 business days and aim to provide an initial
assessment within 10 business days. Once a fix is available, we will coordinate disclosure
timing with you.

## Supported versions

AMX is on a 0.x release line during initial stabilisation. Only the latest minor version
receives security fixes; older releases are best-effort.

| Version | Supported |
|---|---|
| 0.12.x | :white_check_mark: |
| < 0.12 | :x: (upgrade) |

The exact supported-versions table on the AMX repo is the canonical source — this page can
lag behind a release.

## What's in scope

- The `amx` CLI and its agents (search, RAG, profile, code).
- DB connectors and adapters bundled with AMX (PostgreSQL, Snowflake, Databricks,
  BigQuery, MySQL, Oracle, MSSQL, Redshift, ClickHouse, DuckDB).
- The first-run / setup flow and how it persists credentials.

## What's out of scope

- Vulnerabilities in upstream dependencies (please report those upstream — we will pull
  the fix once it is released).
- Issues that require an attacker who already has root or filesystem access on the user's
  machine.
- Issues in third-party LLM or database providers used by AMX.

## Where AMX stores secrets

AMX persists configuration to `~/.amx/config.yml`. Database passwords and API keys may be
stored there in plaintext on older versions; from 0.3.x onward they are stored in the OS
keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service via
[keyring](https://github.com/jaraco/keyring)) when available, and the YAML stores a
reference rather than the secret itself. The config file is written with `0o600`
permissions; the `~/.amx/` directory with `0o700`.

If you find a way to leak secrets out of AMX (for example via logs, crash reports, or
telemetry), please report it under this policy.

See also [Configuration → Where secrets live](configuration/config-yml.md#where-secrets-live)
and [env vars](configuration/env-vars.md) for the cloud-document credentials AMX expects
in environment variables.
