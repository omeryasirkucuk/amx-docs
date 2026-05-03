# FAQ

The most-asked questions, in roughly the order new users hit them.

## Installation

### How do I install AMX?

```bash
pip install amx-cli
```

That's the only command. The install includes the CLI, the multi-agent runtime, every
LLM SDK, and every supported database driver.

### Multiple `amx` binaries on PATH

`amx doctor` reports every `amx` it finds. Usually this means one is in your global pip
install and another is in a project venv. Pick one and uninstall the other, or use a
venv consistently.

## Configuration

### Where does AMX store secrets?

In the OS keychain when available (macOS Keychain, Windows Credential Manager, Linux
Secret Service via libsecret). The YAML stores a reference, not the secret. On headless
Linux without a keychain, secrets fall back to `~/.amx/config.yml` itself with mode
`0o600`.

### `ConfigSchemaTooNewError`

Your AMX binary is older than the config schema in `~/.amx/config.yml`. Upgrade:

```bash
pip install --upgrade amx-cli
```

If you need to downgrade (e.g. team-wide pin), AMX refuses to load the newer config rather
than mangling it. Either roll back the schema by hand (delete the keys from the newer
schema version, decrement `schema_version`) or stand up a separate config with
`amx --config /path/to/old.yml`.

### Can I share a config across machines?

Yes — `amx --config /path/to/team.yml` reads any file. But secrets stored in the OS
keychain don't travel with the YAML; each machine needs its own keychain entries (or
falls back to inline secrets).

## Running

### `/run` failed with "LLM unreachable"

`/analyze /run` tests the active LLM before profiling any asset and stops if the
model/profile is unreachable or deactivated. Run `amx doctor` — it'll tell you whether
the API key is invalid, the endpoint is unreachable, or the model is deactivated.

### `/run` returned 0 visible characters and used all output tokens

This is the reasoning-route token-budget exhaustion message. The model burned the whole
budget on internal thinking. AMX now auto-raises `max_tokens` to 16384 for recognised
reasoning routes, but if you see this, your model isn't recognised. Set the env var
manually:

```bash
export AMX_LLM_MIN_MAX_TOKENS=16384
```

### `finish_reason=length` on every column

The prompt + expected output is bigger than the model's `max_tokens`. AMX **never silently
parses truncated JSON** — the run halts. Either:

- Reduce `/llm-batch-size N` so fewer columns go in one prompt.
- Drop `/n-alternatives` to 1.
- Switch `/prompt-detail` to `minimal`.
- Or raise `max_tokens` if the provider supports it.

### `/run` is slow on a wide schema

Switch profiling to `sampled` or `metadata`. Use `/run --batch` for overnight async runs.
See [Batch mode](../llm-providers/batch-mode.md) and [Profiling
modes](../configuration/profiling-modes.md).

### Why is the suggestion confidence lower than I expected?

A few causes:

- **Anthropic Batch results don't have logprobs** — they fall back to model-declared
  confidence which tends to be conservative.
- **The RAG and Code agents had no evidence for this column** — without external
  evidence, the merge step trusts the Profile Agent alone, which lowers calibrated
  confidence.
- **Logprob thresholds are tuned high.** `/llm-thresholds 0.85 0.6` is the default; lower
  it if you want more rows to land in the `high` band.

## Backends

### Can AMX write back to a read-only DB profile?

No. The `/apply` step needs write privileges. Use a separate profile for write-back:
`amx_reader` for `/run`, `amx_writer` for `/apply`. Or grant `COMMENT` privilege to your
read profile.

### Why is shared mode blocked for ClickHouse / DuckDB?

ClickHouse cannot `UPDATE` rows the way `finish_run` requires. DuckDB is a local file,
not shared storage. Both are blocked at Enable time with a clear error listing the
supported backends.

### Databricks `CERTIFICATE_VERIFY_FAILED`

Set a `tls_trusted_ca_file` on the Databricks DB profile, or set
`AMX_DATABRICKS_TRUSTED_CA_FILE`. See [Databricks](../backends/databricks.md)
and [TLS and proxies](../configuration/tls-and-proxies.md).

## `/ask`

### `/ask` says "no active LLM profile"

`/ask` fails closed when no LLM is configured. Run `/llm` → `/add-llm-profile <name>`.

### `/ask` returned an empty result table

You probably asked a broad semantic question against a schema with no generated
descriptions yet. Either run `/analyze run` against the schema first, or rephrase the
question to use exact identifiers (`/ask what is the ADRC table?`).

### `/ask` answered in the wrong language

`/search` answer language is forced to the detected language of your question. If
detection misfires, prefix your question with the language explicitly: `/ask in English,
which tables …`.

## History and storage

### Where is `~/.amx/history.db`?

On macOS / Linux: `/Users/<name>/.amx/history.db`. On Windows: `C:\Users\<name>\.amx\history.db`.

Override with `AMX_HOME=/some/other/path` (Linux/macOS) or by setting your home directory
explicitly.

### Can I delete `history.db` to start over?

Yes, but you'll lose run history, the search catalog, and all session memory. The next
`amx` start recreates an empty database. `config.yml` is unaffected.

### My teammate's runs aren't visible in `/history list`

In v0.12, **reads still come from local SQLite**. Cross-machine read views are slated
for a follow-up minor. Until then, query the shared backend directly with SQL.

## Where to ask more

- File a question / bug at <https://github.com/omeryasirkucuk/amx/issues>.
- For security issues, see [Security](../security.md).
- See also [doctor](../cli/doctor.md) and [Common errors](common-errors.md).
