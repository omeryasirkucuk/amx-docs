# API reference

Hand-curated reference for the public Python API. For the stability contract and
guidance on which symbols you should depend on, see [Python API](index.md).

This page documents the symbols exported from `amx.core.__all__`. The canonical signatures
live in the [AMX repository](https://github.com/omeryasirkucuk/amx/tree/main/amx/core);
this page mirrors them with prose explanations.

---

## `amx.__version__`

```python
import amx
amx.__version__   # str, e.g. "0.18.0"
```

The installed AMX version. Useful for runtime feature checks and bug reports.

---

## `amx.core.AMXApplication`

```python
@dataclass
class AMXApplication:
    config: AMXConfig
    catalog: SearchCatalog
    store: SQLiteHistoryStore | None = None
```

The composable runtime that owns a config, a search catalog, and (optionally) the local
SQLite history store. Build it via `AMXApplication.load(...)` for the typical case;
constructing it directly is supported for tests and dependency injection.

### `AMXApplication.load`

```python
@classmethod
def load(cls, config_path: str | None = None) -> AMXApplication
```

Loads `config.yml` (default `~/.amx/config.yml`), initialises the local SQLite history
store, and constructs the search catalog. This is the single canonical entry point.

```python
from amx.core import AMXApplication

app = AMXApplication.load()
print(app.config.active_db_profile)           # name of active DB profile
```

### `AMXApplication.state`

```python
@property
def state -> StateManager
```

Returns a [`StateManager`](#amxcorestatemanager) bound to this application's config,
history store, and active DB profile namespace. Use it for write-through config and
session-state mutations.

### `AMXApplication.ask`

```python
def ask(self, question: str) -> SearchAnswer
```

The canonical natural-language ask method. Routes through `SearchService` →
`SearchAgent` (multi-stage retrieval, live probes, verification, synthesis) — the same
pipeline Studio and the CLI's `/ask` use.

`SearchAnswer` carries:

| Field | Description |
|---|---|
| `summary` | The synthesised natural-language answer (rendered, ready to print) |
| `rows` | Underlying catalog rows the agent grounded its answer in |
| `details` | Plan, retrieval, verification, and step-by-step `thought_trace` |

```python
answer = app.ask("which tables in sap_s6p store dates?")
print(answer.summary)
for step in answer.details.get("thought_trace", []):
    print(step.get("step"), "→", step.get("observation"))
```

### `AMXApplication.explain`

```python
def explain(self, question: str) -> dict[str, Any]
```

Same pipeline as `ask`, but returns the structured explanation payload directly (plan,
retrieval, verification, trace). Useful for debugging prompts or building a custom UI on
top of the agent's reasoning.

### `AMXApplication.infer_metadata`

```python
def infer_metadata(
    self,
    schema: str,
    table: str,
    *,
    include_rag: bool = True,
    include_codebase: bool = False,
) -> list[InferenceResult]
```

One-call programmatic metadata inference for a single table. Skips the interactive
review wizard — returns one `InferenceResult` per produced suggestion (table-level + per
column).

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

If `include_rag=True` and the active doc profile has ingested documents, the RAG agent
contributes evidence. If `include_codebase=True` and a code profile is active, the Code
agent does the same. Both default to off-the-network behaviour when their stores are
empty (no LLM call, no error).

### `AMXApplication.run_analysis`

```python
def run_analysis(
    self,
    scope: dict[str, list[str]] | None = None,
    *,
    apply: bool = False,
) -> dict[str, Any]
```

Headless-safe analysis entry point. **Does not open interactive prompts** — when no
explicit scope or saved selection exists, returns a structured `skipped` result. For
full inference + writeback per table, prefer
[`AMXApplication.infer_metadata`](#amxapplicationinfer_metadata) or the CLI `/run`.

```python
result = app.run_analysis(scope={"sap_s6p": ["t001", "vbak"]}, apply=False)
print(result["status"])         # "planned" or "skipped"
print(result["scope"])
```

---

## `amx.core.InferenceResult`

```python
@dataclass(frozen=True)
class InferenceResult:
    schema: str
    table: str
    column: str | None        # None = table-level suggestion
    description: str
    confidence: str           # "high" | "medium" | "low"
    source: str               # "db_profile" | "rag" | "codebase" | "combined"
    asset_kind: str = "table"
    applied: bool = False
    alternatives: tuple[str, ...] = ()
    logprob_score: float | None = None

    def as_dict(self) -> dict[str, Any]
```

Typed metadata-inference result returned from
[`AMXApplication.infer_metadata`](#amxapplicationinfer_metadata). The field set is
stable across minor versions — additive changes only; existing fields keep their
meaning across upgrades.

`as_dict()` returns a JSON-safe dict for logging or transport. `alternatives` is a
tuple in the dataclass and a list in the dict view.

---

## `amx.core.AbstractEntity`

```python
@dataclass(frozen=True)
class AbstractEntity:
    entity_id: str
    kind: str
    lexical: LexicalSignal
    structural: StructuralSignal
    statistical: StatisticalSignal
    semantic: SemanticSignal
    provenance: tuple[str, ...] = ()

    @property
    def path(self) -> str       # convenience: lexical.path
```

Backend-neutral entity abstraction used by the [Universal Metadata Interface](../concepts/universal-metadata.md).
Every column or table profiled by an AMX adapter is normalised into an `AbstractEntity`
before reaching the agents.

The four sub-signals (`LexicalSignal`, `StructuralSignal`, `StatisticalSignal`,
`SemanticSignal`) are part of the `AbstractEntity` shape — implicitly public, additive
field changes only across minor versions.

| Sub-signal | Carries |
|---|---|
| `LexicalSignal` | `name`, `path`, `aliases` — the technical labels |
| `StructuralSignal` | `dtype`, `nullable`, `asset_kind`, `primary_key`, `foreign_keys`, `referenced_by` — shape and relationship facts |
| `StatisticalSignal` | `row_count`, `null_count`, `distinct_count`, `cardinality_ratio`, `min_value`, `max_value`, `samples` — profiled distribution facts |
| `SemanticSignal` | `description`, `documentation`, `source`, `confidence` — human-authored or model-derived semantic evidence |

---

## `amx.core.UniversalMetadataAdapter`

```python
class UniversalMetadataAdapter:
    @staticmethod
    def from_table_profile(profile: TableProfile) -> list[AbstractEntity]
```

Maps backend-specific column / table profiles into `AbstractEntity` instances. Returns one
`AbstractEntity` for the table itself plus one per column.

```python
from amx.core import AMXApplication, UniversalMetadataAdapter

app = AMXApplication.load()
# (TableProfile is internal; in practice, AMXApplication.run_analysis or
# infer_metadata yield AbstractEntity / InferenceResult objects already.)
```

In normal use, you don't call `UniversalMetadataAdapter` directly — the orchestrator
applies it internally. It's part of the public surface so external integrations (e.g. a
custom metadata UI) can produce the same canonical shape.

---

## `amx.core.StateManager`

```python
@dataclass
class StateManager:
    config: AMXConfig
    store: SQLiteHistoryStore | None = None
    namespace: str = "default"

    def set_config(self, key: str, value: Any) -> None
    def set_session_state(self, key: str, value: Any) -> None
    def get_session_state(self, key: str, default: Any = None) -> Any
    def record_agent_state(self, agent_name: str, state: dict[str, Any]) -> None
```

Write-through persistence for config and SQLite-backed session state across AMX sessions.

```python
from amx.core import AMXApplication

app = AMXApplication.load()
state = app.state                                    # StateManager
state.set_config("active_db_profile", "snow_prod")   # persists to config.yml
state.set_session_state("last_query", "tables with dates")   # persists to history.db
prev = state.get_session_state("last_query")
```

`set_config(key, value)` raises `KeyError` if `key` isn't an attribute of the loaded
`AMXConfig` — guards against typos.

`set_session_state` / `get_session_state` / `record_agent_state` use the SQLite history
store; they're a no-op when `store` is `None`.

---

## On-disk shapes (also part of the contract)

These are stable across minor versions:

- **`~/.amx/config.yml`** — see [Configuration → config.yml](../configuration/config-yml.md).
- **`~/.amx/history.db`** — SQLite tables `analysis_runs`, `run_results`, `app_events`,
  `session_state`, `pending_shared_writes`. Additive migrations within a major version.
- **`--json` export shape** — keys `schema_version`, `run_summary`, `per_column`,
  `aggregate_metrics` are stable. Full shape documented at
  [`tests/eval/README.md`](https://github.com/omeryasirkucuk/amx/blob/main/tests/eval/README.md).

---

## Internal symbols (do not depend on)

Anything not on this page is internal. Importing it works today but the symbol,
signature, location, or behaviour can change in any release without notice. See
[Python API → What's internal](index.md#whats-internal) for the highlights.
