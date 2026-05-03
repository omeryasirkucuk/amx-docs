# `~/.amx/config.yml`

AMX persists profiles and settings to `~/.amx/config.yml`. The file is part of the public
contract: the schema is versioned, an older AMX binary refuses to load a newer config
(`ConfigSchemaTooNewError`) rather than silently mangling it, and additive changes within a
major version are guaranteed not to break older readers.

## Quick view

```text
/config
```

shows the currently-active profiles and resolved settings. To inspect the file directly:

```bash
cat ~/.amx/config.yml
```

The file is created with mode `0o600` and the `~/.amx/` directory with `0o700`.

## File location

| Behaviour | Path |
|---|---|
| Default | `~/.amx/config.yml` |
| Override | `amx --config /path/to/team.yml` |

You can use a different file per project — useful when you maintain separate AMX configs
for different employers or open-source workspaces.

## Schema overview

The current schema version is **v2** (introduced in 0.12.0).

```yaml
schema_version: 2

# DB profiles — one per database connection
db_profiles:
  prod_pg:
    backend: postgresql
    host: pg.internal.example.com
    port: 5432
    database: warehouse
    user: amx_reader
    sslmode: require
    profiling_mode: full           # full | sampled | metadata
    profiling_max_rows: 5_000_000
    profiling_sample_size: 5

  snow_prod:
    backend: snowflake
    account: xy12345.eu-west-1
    user: AMX_SVC
    warehouse: AMX_WH
    role: AMX_ROLE
    database: ANALYTICS
    schema: PUBLIC
    private_key_path: ~/.snowflake/amx.p8

  databricks-prod:
    backend: databricks
    host: adb-1234567890123456.7.azuredatabricks.net
    http_path: /sql/1.0/warehouses/abcd1234ef567890
    catalog: my_catalog
    database: my_schema
    tls_trusted_ca_file: ~/certs/internal-ca.pem
    tls_no_verify: false

# LLM profiles — one per provider/model combination
llm_profiles:
  openai_main:
    provider: openai
    model: gpt-4o-mini
    temperature: 0.2                # 0.0 – 2.0; default 0.2
    language: en
    prompt_detail: standard         # minimal | standard | detailed | full
    n_alternatives: 3               # 1 – 5
    llm_batch_size: 20              # columns per Profile-Agent LLM call
    batch_context_columns: 8        # off | all | N
    logprob_thresholds:
      high: 0.85
      medium: 0.6

  anthropic_sonnet:
    provider: anthropic
    model: claude-3-5-sonnet-latest
    temperature: 0.3

# Document profiles — one per document set
doc_profiles:
  sap_handbook:
    paths:
      - ~/work/sap-docs
      - https://github.com/example/sap-docs
      - s3://team-docs/sap/

# Codebase profiles — one per repository
code_profiles:
  etl_repo:
    paths:
      - ~/work/company-etl
    include_extensions: [py, sql, java, scala]
    exclude_globs:
      - "**/node_modules/**"
      - "**/.venv/**"

# Active selections — what each "implicit" command targets
active:
  db: prod_pg
  llm: openai_main
  doc: sap_handbook
  code: etl_repo

# Settings
settings:
  write_through_config: true        # save profile switches and config mutations immediately
  force_logprobs: true              # request logprobs even if provider capability is uncertain
  max_tokens: 4096                  # default; reasoning models auto-raise to 16384

# Shared history store (v2, optional)
history_store_enabled: true
history_store_profile: prod_pg
history_store_schema: AMX
```

## Schema versioning

`schema_version: 2` was introduced in 0.12.0 and adds three optional keys
(`history_store_enabled`, `history_store_profile`, `history_store_schema`).

- Existing 0.11.x configs (no `schema_version`, or `schema_version: 1`) load unchanged.
- A 0.11.x AMX binary trying to read a 0.12+ config sees `schema_version: 2` and raises
  `ConfigSchemaTooNewError` with an upgrade prompt — never silently mangles the file.
- Future schema bumps follow the same rule: additive only within a major version, always
  bump `schema_version`, always refuse to load newer files.

The on-disk format is part of the [public API contract](../api/index.md#on-disk-formats).

## Where secrets live

Database passwords and API keys are **not stored in `config.yml`** when the OS keychain
is available. Instead, the YAML stores a reference (`__keychain__:amx:openai_main:api_key`)
and AMX retrieves the actual secret via [keyring](https://github.com/jaraco/keyring) at
runtime.

| OS | Keychain backend |
|---|---|
| macOS | macOS Keychain |
| Windows | Windows Credential Manager |
| Linux | Secret Service (libsecret) |

When no keychain is available (e.g. headless Linux without `dbus`), AMX falls back to
storing the secret in `config.yml` itself, with the file mode kept at `0o600`. This is
safe enough on a single-user machine but you should configure a real keychain in any
multi-user environment.

## Editing safely

`write_through_config: true` (default) means AMX saves the YAML atomically after each
mutation. You can edit the file by hand when AMX is not running:

1. Quit any running `amx` session (`Ctrl+D` or `/exit`).
2. Edit `~/.amx/config.yml` with your editor of choice.
3. Restart `amx`.

If you edit while AMX is running, your changes are likely to be overwritten by the next
write-through.

For programmatic edits, use the public API:

```python
import amx

app = amx.init()
app.config.set_active_db("prod_pg")
app.save_config()
```

See [Python API](../api/reference.md).

## Config troubleshooting

```bash
amx doctor
```

Reports config schema version, missing optional backend deps, and unreachable profiles.
See [doctor](../cli/doctor.md).

If `config.yml` is corrupt and AMX can't start, delete or rename it and run `/setup`
again — the file is regenerated from scratch. Local history (`history.db`) is unaffected.
