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
amx.__version__   # str, e.g. "0.12.0"
```

The installed AMX version. Useful for runtime feature checks and bug reports.

---

## `amx.init`

```python
def init(config_path: str | None = None) -> AMXApplication
```

Convenience wrapper around `AMXApplication.load(config_path)`. Use it for one-line scripts:

```python
import amx

app = amx.init()                              # loads ~/.amx/config.yml
app = amx.init("/path/to/team.yml")           # custom config
```

Library code should prefer `from amx.core import AMXApplication` and call
`AMXApplication.load(...)` directly — same effect, no top-level import surprise.

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
store, and constructs the search catalog. This is the standard entry point.

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

Run a single-shot ask question through the legacy `SearchService` pipeline.

`SearchAnswer` is the same shape used internally by `/ask`. Prefer `ask_with_tools` for
new code — it returns the richer `ToolAskResponse` with the full reasoning trace.

### `AMXApplication.ask_with_tools`

```python
def ask_with_tools(self, question: str) -> ToolAskResponse
```

Run the question through the loop-based ask agent. Returns a structured response with
the answer, intent, tool trace, and confidence — see [`ToolAskResponse`](#amxcoretoolaskresponse).

```python
response = app.ask_with_tools("which tables in sap_s6p store dates?")
print(response.answer)
for step in response.trace:
    print(step.action, "→", step.observation)
```

### `AMXApplication.explain`

```python
def explain(self, question: str) -> dict[str, Any]
```

Lower-level: returns the planner's reasoning + retrieval plan for a question without
producing a final answer. Useful for debugging prompts.

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
explicit scope or saved selection exists, returns a structured `skipped` result.

For full inference + writeback, prefer [`infer_table_metadata`](#amxcoreinfer_table_metadata)
or the CLI `/run`.

```python
result = app.run_analysis(scope={"sap_s6p": ["t001", "vbak"]}, apply=False)
print(result["status"])         # "planned" or "skipped"
print(result["scope"])
```

---

## `amx.core.infer_table_metadata`

```python
def infer_table_metadata(
    cfg: AMXConfig,
    schema: str,
    table: str,
    *,
    include_rag: bool = True,
    include_codebase: bool = False,
) -> list[dict[str, Any]]
```

One-call programmatic metadata inference for a single table. Skips the interactive review
wizard — returns suggestion dicts ready for your own UI to consume.

```python
import amx
from amx.core import infer_table_metadata

app = amx.init()
results = infer_table_metadata(
    app.config,
    schema="sap_s6p",
    table="t001",
    include_rag=True,
    include_codebase=True,
)

for col in results:
    print(f"{col['column']:30s}  {col['confidence']:8s}  {col['description']}")
```

Each result dict carries the column identifier, top description, alternatives,
confidence band, logprob (when available), evidence sources, and provenance. The shape is
stable across minor versions; new optional fields may be added.

If `include_rag=True` and the active doc profile has ingested documents, the RAG agent
contributes evidence. If `include_codebase=True` and a code profile is active, the Code
agent does the same. Both default to off-the-network behaviour when their stores are
empty (no LLM call, no error).

---

## `amx.core.AskToolbox`

```python
class AskToolbox:
    def __init__(
        self,
        cfg: AMXConfig,
        catalog: SearchCatalog,
        *,
        db_factory: Callable[[], DatabaseConnector] | None = None,
        doc_query: Callable[[str, int], list[dict[str, Any]]] | None = None,
    ) -> None
```

Bounded set of metadata tools the loop-based ask agent can call. The tools include catalog
lookups, schema exploration, safe live DB probes, and (when configured) a document-query
hook.

You typically don't construct an `AskToolbox` directly — use `AMXApplication.ask_with_tools`
which builds one for you. Construct it manually only when you want to inject custom
`db_factory` or `doc_query` implementations (e.g. for tests).

```python
from amx.core import AMXApplication, AskToolbox, LoopBasedAskAgent

app = AMXApplication.load()
toolbox = AskToolbox(app.config, app.catalog)
agent = LoopBasedAskAgent(toolbox)
response = agent.answer("which tables in sap_s6p store dates?")
```

---

## `amx.core.LoopBasedAskAgent`

```python
class LoopBasedAskAgent:
    def __init__(self, toolbox: AskToolbox) -> None: ...
    def answer(self, question: str) -> ToolAskResponse: ...
```

Headless re-implementation of `/ask` for scripts and notebooks. Wraps the multi-step
Search Agent pipeline (interpret → plan → retrieve → verify → synthesise) in a single
`answer(question)` call.

---

## `amx.core.ToolAskResponse`

```python
@dataclass(frozen=True)
class ToolAskResponse:
    question: str
    answer: str
    trace: list[ReasoningTraceStep]
    tool_results: list[ToolResult]
    strategy: str = ""

    def as_dict(self) -> dict[str, Any]
```

Structured response from `LoopBasedAskAgent.answer(...)` (and from
`AMXApplication.ask_with_tools`).

| Field | Description |
|---|---|
| `question` | The original question, echoed |
| `answer` | The synthesised natural-language answer |
| `trace` | Ordered `ReasoningTraceStep` objects: `step`, `action`, `observation` |
| `tool_results` | Raw `ToolResult` objects from each tool invocation: `tool`, `query`, `rows`, `error` |
| `strategy` | Picked answer shape (`single_fact`, `short_table`, `full_table`, `ranked_list`, `table_summary`, `join_candidates`, `prose`) |

`as_dict()` returns a JSON-safe dict for logging or transport.

`ReasoningTraceStep` and `ToolResult` are part of the `ToolAskResponse` shape and
therefore implicitly public — additive field changes only across minor versions.

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
# infer_table_metadata yield AbstractEntity objects already.)
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
