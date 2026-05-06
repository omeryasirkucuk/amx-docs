# Python API

AMX has a small, **stable** programmatic API for headless use — driving the multi-agent
inference pipeline from a Python script, notebook, or service without going through the
interactive CLI shell. This page is the contract; the [Reference](reference.md) is the
hand-curated detail.

## Stability promise

Anything documented here will follow [Semantic Versioning](https://semver.org/) starting
from `1.0.0`:

- **Patch** (`1.0.x`) — bug fixes, no public-API changes.
- **Minor** (`1.x.0`) — additive only (new names, new optional kwargs, new optional fields
  on returned dataclasses). Existing code keeps working.
- **Major** (`x.0.0`) — breaking changes only here, with a `DEPRECATED` notice in a prior
  minor release whenever practical.

Anything **not** listed in this document is **internal**. Importing it works today but the
symbol, signature, location, or behaviour can change in any release without notice. If
something internal is genuinely useful to you, [open an issue](https://github.com/omeryasirkucuk/amx/issues) —
we'll consider promoting it.

## Pre-1.0 caveat

While AMX is at `0.x`, the contract is **best-effort**. We avoid breaking the listed
symbols whenever possible and flag any necessary breakage in the [changelog](../changelog.md)
under `BREAKING CHANGE`. Hard guarantees kick in at `1.0.0`.

If a stability guarantee here matters to you for production use, [open an issue](https://github.com/omeryasirkucuk/amx/issues)
— we'd rather hear it now than break you later.

## What's public

### Top-level convenience surface (`amx`)

| Symbol | Kind | Stability |
|---|---|---|
| `amx.__version__` | `str` | Stable |
| `amx.AMXApplication` | class (lazy re-export) | Stable |
| `amx.AbstractEntity` | class (lazy re-export) | Stable |
| `amx.UniversalMetadataAdapter` | class (lazy re-export) | Stable |

These are re-exports of names defined in `amx.core` for one-line scripts. Library code
should prefer importing from `amx.core` directly.

### `amx.core` — library-first API

Every name listed in `amx.core.__all__` is part of the public contract:

| Symbol | Kind | What it does |
|---|---|---|
| `amx.core.AMXApplication` | dataclass | Composable runtime that owns a config, a history store, and the active agents. Built via `AMXApplication.load(config_path)` for the typical case. |
| `amx.core.InferenceResult` | dataclass | Typed metadata-inference result returned from `AMXApplication.infer_metadata`. Stable field set with additive growth across minor versions. |
| `amx.core.AbstractEntity` | dataclass | Backend-neutral entity abstraction used by the Universal Metadata Interface. |
| `amx.core.UniversalMetadataAdapter` | class | Maps backend-specific column / table profiles into `AbstractEntity`. |
| `amx.core.StateManager` | class | Write-through persistence for config + SQLite-backed state across sessions. |

### `AMXApplication` methods

| Method | Returns | What it does |
|---|---|---|
| `AMXApplication.load(config_path=None)` | `AMXApplication` | Classmethod factory; the single canonical constructor. |
| `app.ask(question)` | `SearchAnswer` | Runs the unified ask pipeline (multi-stage retrieval, live probes, verification, synthesis). |
| `app.explain(question)` | `dict[str, Any]` | Same pipeline as `ask` but returns the structured explanation payload. |
| `app.infer_metadata(schema, table, *, include_rag=True, include_codebase=False)` | `list[InferenceResult]` | Headless metadata inference for one table. |
| `app.run_analysis(scope=None, *, apply=False)` | `dict[str, Any]` | Headless-safe analysis entrypoint. |
| `app.state` | `StateManager` | Property — write-through state for the active profile namespace. |

For full docstrings and field shapes, see [Reference](reference.md).

### CLI

The `amx` console script (defined under `[project.scripts]` in `pyproject.toml`) is part of
the public API:

- The set of slash commands documented in [CLI Reference](../cli/overview.md) is the
  contract.
- Slash command **flags** (`--db-profile`, `--last`, `--diff`, `--csv`, …) are stable
  within a major version.
- Output is **rendered for humans** — no contract on column order, terminal styling, or
  table widths. Scripts that need to consume AMX output should use the export flags
  (`--csv`, `--md`, `--json`) where available.

### On-disk formats

These are part of the public contract because users depend on them across upgrades:

- **`~/.amx/config.yml`** — schema is versioned (`schema_version: N` field, see
  `amx.config.CONFIG_SCHEMA_VERSION`). When AMX bumps the schema, an older binary refuses
  to load a newer config rather than silently mangling it (raises
  `ConfigSchemaTooNewError`). Full layout in [config.yml](../configuration/config-yml.md).
- **`~/.amx/history.db`** — SQLite tables (`analysis_runs`, `run_results`, `app_events`,
  etc.) accept additive migrations within a major version. Column types and the meaning
  of existing columns are stable.
- **`--json` export shape** — the keys `schema_version`, `run_summary`, `per_column`,
  `aggregate_metrics` are stable. The full JSON shape is documented in the AMX repo at
  `tests/eval/README.md`.

## What's internal

Everything else. Highlights:

| Module | Why it's internal |
|---|---|
| `amx.cli`, `amx.cli_support.*` | CLI plumbing, refactored frequently |
| `amx.cli_*` (top-level shims like `amx.cli_db`, `amx.cli_run`) | Backwards-compat shims that re-export from `amx.cli_support.commands.*`; will be removed in a future major release. Use the underlying modules only at your own risk; prefer `amx.core.*` for programmatic access. |
| `amx.agents.*` | Profile / RAG / Code agent internals. The orchestrator decides what gets called and how — directly instantiating these from user code couples you to the agent contract. |
| `amx.core.inference.infer_table_metadata` | Internal implementation behind `AMXApplication.infer_metadata`. Use the application method. |
| `amx.search._agent.*`, `amx.search._catalog.*` | Already underscore-prefixed. Do not import. |
| `amx.search.agent`, `amx.search.catalog`, `amx.search.service` | Public-shaped names but not part of the contract — use `amx.core.AMXApplication` to get a configured `SearchService`. |
| `amx.db.*`, `amx.llm.*`, `amx.docs.*`, `amx.codebase.*` | Backend adapters; tightly coupled to the active config. |
| `amx.storage.*` | History store implementation. `amx.core.AMXApplication.store` exposes the configured store. |
| `amx.utils.*` | Internal helpers (Rich console wrappers, logging, token counting). |
| `amx.config.AMXConfig` | Used internally; configure programmatically by passing a path to `AMXApplication.load(...)` or by editing `~/.amx/config.yml`. The dataclass shape is **not** stable. |

## How to write code that survives upgrades

```python
# Good — uses only public surface.
from amx.core import AMXApplication

app = AMXApplication.load("~/.amx/config.yml")
suggestions = app.infer_metadata(
    "sales", "orders", include_rag=True, include_codebase=False
)
for s in suggestions:
    print(s.column, s.confidence, s.description)
```

```python
# Risky — imports an internal symbol whose location may move.
from amx.search.service import SearchService           # internal
from amx.agents.orchestrator import Orchestrator       # internal

# The replacement when this breaks:
from amx.core import AMXApplication
app = AMXApplication.load(...)
answer = app.ask("which tables store dates?")
```

## Headless `/ask` from Python

```python
from amx.core import AMXApplication

app = AMXApplication.load("~/.amx/config.yml")
answer = app.ask("which tables in sap_s6p store dates?")

print(answer.summary)
for row in answer.rows:
    print(row.get("schema_name"), row.get("table_name"), row.get("column_name"))
```

`AMXApplication.ask` is the single canonical ask method — both Studio and the CLI's
`/ask` route through the same `SearchService` → `SearchAgent` pipeline. The returned
`SearchAnswer` carries the rendered summary plus the underlying rows the agent grounded
its answer in. Detailed retrieval / verification trace is on `answer.details`.

## Headless `/run` from Python

```python
from amx.core import AMXApplication

app = AMXApplication.load()
results = app.infer_metadata(
    schema="sap_s6p",
    table="t001",
    include_rag=True,
    include_codebase=True,
)

for r in results:
    print(f"{r.column or '<table>':30s}  {r.confidence:6s}  {r.description}")
```

`InferenceResult` is a frozen dataclass — fields can be added in minor versions but not
removed. The current shape:

| Field | Type | Notes |
|---|---|---|
| `schema` | `str` | Source schema |
| `table` | `str` | Source table |
| `column` | `str \| None` | `None` for table-level suggestions |
| `description` | `str` | Suggested description |
| `confidence` | `str` | `"high"` / `"medium"` / `"low"` |
| `source` | `str` | `"db_profile"`, `"rag"`, `"codebase"`, `"combined"` |
| `asset_kind` | `str` | `"table"`, `"view"`, `"materialized_view"`, … |
| `applied` | `bool` | `True` when the suggestion was already written back |
| `alternatives` | `tuple[str, ...]` | Other phrasings the agent considered |
| `logprob_score` | `float \| None` | Token-level confidence score when available |

Call `r.as_dict()` for a JSON-safe view.

## Where to read further

- [Reference](reference.md) — hand-curated symbol-by-symbol detail.
- [config.yml](../configuration/config-yml.md) — the on-disk format the API reads/writes.
- [CLI overview](../cli/overview.md) — when you'd reach for the CLI vs the library API.
- [`docs/PUBLIC_API.md`](https://github.com/omeryasirkucuk/amx/blob/main/docs/PUBLIC_API.md)
  in the AMX repo — the canonical source for this contract.
