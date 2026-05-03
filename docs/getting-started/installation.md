# Installation

AMX is a Python package distributed on PyPI.

## Prerequisites

- **Python 3.10 or newer.** AMX is tested on 3.10, 3.11, and 3.12.
- **A database you can connect to.** Any of the [10 supported backends](../backends/index.md).
- **At least one LLM provider configured.** OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter,
  Ollama, or any OpenAI-compatible local endpoint (vLLM / LM Studio / …).

AMX focuses on metadata inference, not bulk data loading. Populate schemas and tables with
your own ETL process, then point AMX at that database.

## Install

```bash
pip install amx-cli
```

That's it. The install includes the CLI, the multi-agent runtime, all LLM SDKs, the
RAG / search / codebase machinery, and every supported database driver.

## Install from source

For development or to track a feature branch:

```bash
git clone https://github.com/omeryasirkucuk/amx.git
cd amx
pip install -e .
pre-commit install
```

See [Contributing](../contributing.md) for the full development workflow.

## Verify the install

```bash
amx --version
> /doctor
```

`/doctor` reports every `amx` binary on `PATH` (catches the version-skew bug class), the
Python runtime, the config schema version, and active DB + LLM reachability. It runs from
a broken state — no interactive session required. Use `/doctor --skip-network` for an
offline quick check.

## Where AMX writes files

| Path | Purpose |
|---|---|
| `~/.amx/config.yml` | Profiles, settings (mode `0o600`) |
| `~/.amx/history.db` | Local SQLite: runs, results, app events, search catalog |
| `~/.amx/logs/amx.log` | Structured logs |
| `~/.amx/code_cache/<slug>/` | Cached code-scan results per profile |

Secrets are stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux
Secret Service) when available; the YAML stores a reference rather than the secret itself.

## Upgrading

```bash
pip install --upgrade amx-cli
```

AMX uses semantic versioning. `0.x` is best-effort but breaking changes are flagged in the
[changelog](../changelog.md) under `BREAKING CHANGE`. Hard guarantees on the public Python
API and CLI surface kick in at `1.0.0` — see the [Python API page](../api/index.md) for the
full contract.

If a newer config schema is detected by an older AMX binary, AMX raises
`ConfigSchemaTooNewError` rather than silently mangling the file. Upgrade or downgrade
accordingly.

## Next steps

- [Quick start](quickstart.md) — five-minute happy path.
- [First run walkthrough](first-run.md) — narrated review session.
- [Per-backend setup](../backends/index.md) — connection details for each supported engine.
