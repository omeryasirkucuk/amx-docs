# The three sub-agents

AMX runs three independent sub-agents over each asset, then merges their suggestions through
an orchestrator. Each agent has a single responsibility and a clear evidence source.

| Agent | Source | Implementation | Confidence signals |
|---|---|---|---|
| **Profile Agent** | Database | `amx.agents.profile_agent` | Logprobs, sample-value coverage, FK signals |
| **RAG Agent** | Documents | `amx.agents.rag_agent` | Retrieval similarity, snippet authoritativeness |
| **Code Agent** | Codebase | `amx.agents.code_agent` | Reference count, semantic similarity in `amx_code` |

## Profile Agent

The Profile Agent is the only agent guaranteed to have evidence — every column has at least
its declared type. For each table, AMX sends the LLM:

- **Scope:** database name, schema, table.
- **Table-level context:** row count, existing table comment, schema comment, database comment.
- **Constraints and relationships:**
    - Primary key columns
    - Outgoing foreign keys (upstream dependencies)
    - Incoming foreign keys (downstream dependents)
    - Unique constraints
    - Check constraints
- **Usage stats** when available.
- **Related metadata:** existing comments on FK-related neighbour tables.
- **Per-column profile:**
    - name, type, nullable
    - null count, distinct count, cardinality ratio (`distinct_count / row_count`)
    - min / max value (as text)
    - up to 5 distinct non-null sample values
    - existing column comment

AMX **does not send full table dumps**. It sends summarised profiling signals and small
samples for inference.

### Profiling guardrails

Each DB profile carries one of three modes — see [Profiling modes](../configuration/profiling-modes.md)
for the full breakdown:

- `full` — exact row count + per-column null/distinct/min/max + samples.
- `sampled` — table statistics + small sample only.
- `metadata` — schema metadata + comments + table statistics. No table-data reads.

### Failure handling

Backend profiling failures are normalised into actionable messages. Permission errors,
missing objects, warehouse / quota / connection failures surface remediation text instead
of leaking raw driver tracebacks. AMX can skip expensive per-column stats when a single
column-level stats query fails — the run keeps making progress.

## RAG Agent

Reads the active document profile, retrieves relevant snippets per column from the local
Chroma store, and generates suggestions backed by those snippets.

### Document ingestion

`/index` walks each configured root, splits files into chunks (`langchain-text-splitters`),
embeds them, and upserts into Chroma. Default embeddings are MiniLM (offline). Switch to
OpenAI-compatible or local sentence-transformers via `/embeddings docs <kind>`. The
code-agent side is independent — change it with `/embeddings code <kind>`.

Supported file types: `pdf`, `docx`, `doc`, `txt`, `md`, `csv`, `xlsx`, `xls`, `html`,
`htm`, `pptx`, `json`, `yaml`, `yml`, `rst`, `rtf`.

### Document sources

- **Local files / directories** — `/path/to/docs`
- **GitHub repositories** — cloned to a temp dir for the active scan, then deleted
- **AWS S3** — `s3://bucket/prefix`
- **Google Drive** — public links zero-config; private files via service account or OAuth
- **SharePoint / OneDrive** — public sharing links zero-config; private via Azure app

See [Documents](../data-sources/documents.md) for credential setup.

### What the RAG Agent sends

For each column:

- The column's name + type + table context.
- Top-K retrieved chunks (default 5) ranked by vector similarity.
- The chunk's source path so the prompt can mention provenance.

Suggestions whose retrieval similarity falls below the floor are downweighted to `low`
confidence so weak evidence doesn't overpower a high-quality Profile suggestion at merge time.

## Code Agent

Scans the active codebase profile and surfaces references to each column or table.
Two complementary mechanisms:

1. **Literal reference scan.** Walks the tree, captures occurrences of identifiers in their
   source context (function name, file path, surrounding lines). Cached on disk per profile.
2. **Semantic code RAG.** Chroma collection `amx_code` holds embedded chunks (Python by
   function/class span; other languages by text split). The Code Agent queries by
   table/column name and feeds the nearest neighbours into the LLM prompt.

Chunks are tagged by source path and the agent **filters retrieval to the active code
profile** so a multi-repo machine doesn't bleed snippets from one project into another.

### Identifiers outside the DB

Strings that look like catalog objects but are not in the connected table list appear as
**secondary context** for the LLM (for example external lake tables referenced from your
ETL repo). The agent labels them as such so the merge step can weight them appropriately.

### Cache

`~/.amx/code_cache/<slug>/` stores a manifest plus serialised scan results so `/run` does
not re-walk the repo every time. Use `/code-index` after the tree
changes; refresh clears the active profile's cache **and** semantic chunks.

GitHub document and codebase sources are cloned into temporary directories only for the
active index operation, then removed.

## Orchestrator

The orchestrator (`amx.agents.orchestrator`) merges per-column candidate sets from all three
agents into a final ranked list. The merge prompt:

- Uses **source precedence** rather than averaging conflicting descriptions. Profile +
  Code references beat a single doc snippet; explicit comments in the DB beat inferred ones.
- Calibrates confidence using logprob thresholds (`high` / `medium` / `low`) configured via
  `/logprob-thresholds`. The agent prompts explicitly avoid unsupported business claims and
  explain confidence using evidence classes.
- Never silently parses truncated JSON: when `finish_reason=length`, AMX halts processing and
  reports the truncation rather than guessing.

The orchestrator also produces a **table-level summary** describing what the table is for,
which is useful for downstream `/ask` queries.

## Confidence and logprobs

When provider token offsets can be reconstructed, AMX scores generated description text per
suggestion using token logprobs. Otherwise it falls back to a whole-response score. Tune the
thresholds:

```text
/llm-thresholds 0.85 0.6
```

means logprob ≥ 0.85 → `high`, ≥ 0.6 → `medium`, otherwise `low`.

Confidence labels are also surfaced in `/history compare` so you can see how a prompt-detail
or model change shifts the distribution between runs.

## Tuning knobs

Every behaviour above can be tuned for throughput / latency:

- `/llm-batch-size N` — how many columns the Profile Agent sends in one LLM call.
- `/batch-context-columns off|all|N` — non-batch column names included as context per batch.
- `/n-alternatives 1..5` — alternatives per column. Default 3.
- `/prompt-detail minimal|standard|detailed|full` — preset prompt budgets.
- `/profiling sampled|metadata` — switch DB profiling intensity.
- `/llm-batch-size` and OpenAI / Anthropic batch endpoints (`/run --batch`) for very large
  schemas.

See [Batch mode](../llm-providers/batch-mode.md) and [Profiling modes](../configuration/profiling-modes.md).
