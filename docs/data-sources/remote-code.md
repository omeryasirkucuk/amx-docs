# Remote code-asset ingestion

Beyond local source code (the [Codebase](codebase.md) page), AMX
ingests **executable assets** that live inside your data platform —
notebooks, jobs, pipelines, queries, streams, and Streamlit apps —
straight from Databricks and Snowflake. The same Code Agent that
mines a `dbt` project for column references mines these remote
assets the same way: source text becomes evidence, the catalog
gains a richer surface for `/ask`, and the Lineage canvas can
display the actual transformation graph instead of just the
database side of the world.

## Asset types

| Asset type | Databricks | Snowflake |
|---|---|---|
| Notebooks | ✅ | ✅ |
| Jobs (+ task DAG) | ✅ | — |
| Pipelines (DLT) | ✅ | — |
| Streamlit apps | — | ✅ |
| Streams | — | ✅ |
| Query history | ✅ | ✅ |
| Task dependencies | ✅ (derived from jobs) | — |

Other backends do not currently expose executable assets through a
first-class API, so ingestion is no-op for them and the wizard
explains why.

## Prerequisites

- An active Databricks or Snowflake DB profile (`/db add`).
- For Databricks: a workspace access token (or workspace token, see
  [config.yml](../configuration/config-yml.md)) with permission to
  list the workspace tree and read notebook bodies.
- For Snowflake: an account with `IMPORTED PRIVILEGES` on
  `SNOWFLAKE.ACCOUNT_USAGE` if you want query history, plus
  whatever role lists the notebook / Streamlit app / stream
  metadata.
- An active LLM profile if you plan to embed the ingested source
  for RAG search; ingestion itself is metadata-only and is fine
  without an LLM.

## Ingest from the CLI

The entry point is `/db ingest-assets`. Bare call runs the wizard;
flags are optional shortcuts.

```text
> /db ingest-assets
[1/3] DB profile: prod-dbx
[2/3] Asset types to ingest:
  [x] notebooks
  [x] jobs
  [x] pipelines
  [x] queries
  [ ] task_dependencies
[3/3] History window for queries: 7 days  (cap: 1,000 rows)

→ notebooks       │ 412 fetched, 38 updated, 0 errors
→ jobs            │  87 fetched, 12 updated, 0 errors
→ pipelines       │   9 fetched,  1 updated, 0 errors
→ queries         │ 1,000 fetched (capped), 0 errors
✓ Ingest complete in 1m 04s
```

Power-user form:

```text
/db ingest-assets \
  --profile prod-dbx \
  --types notebooks,jobs,queries \
  --history-days 30 \
  --runs-per-job 50 \
  --query-history-limit 5000
```

**Cherry-pick by id.** `--include-id KIND:EXTERNAL_ID` is
repeatable and limits a given kind to just the listed assets while
leaving other kinds in "all" mode. Useful for re-syncing one
notebook after an edit:

```text
/db ingest-assets --profile prod-dbx \
  --include-id notebooks:abc123 \
  --include-id jobs:42
```

## Browse and search

`/db assets` is the namespace for working with what is already
ingested.

| Command | Purpose |
|---|---|
| `/db assets list [--type KIND] [--limit N] [--search TEXT]` | Tabular list, paginated, with substring filter against name + path. |
| `/db assets show <id>` | Full detail for one asset — source, lineage links, owner. |
| `/db assets search <query> [--limit N]` | Embedding search across ingested source text. |
| `/db assets refresh` | Drop and re-ingest every asset for the active profile (asks for confirmation). |
| `/db assets reindex` | Re-embed ingested assets under the current chunking strategy (after `/db assets chunking` changes). |
| `/db assets prune` | Delete rows that no longer exist on the remote platform. |
| `/db assets chunking [--show]` | View or edit the per-kind chunking strategy. |

## Storage

Each ingested kind has its own table in the history store:

- `remote_notebooks` — notebook id, workspace path, qualified name,
  source text, last modification timestamp.
- `remote_jobs` — job id, name, schedule, recent run summary; child
  table `remote_job_tasks` holds the per-task DAG with FKs to
  `remote_notebooks`, `remote_pipelines`, etc.
- `remote_pipelines` — DLT pipeline id, name, target schema, source
  definitions.
- `remote_queries` — query id, name, sql text, warehouse, executed-at
  timestamp, kind.
- `remote_streamlit_apps` — qualified name, main file, query warehouse.
- `remote_streams` — qualified name, source table FQN, stream mode.

Each of these has a matching FTS5 sidecar (e.g. `remote_notebooks_fts`)
maintained by INSERT/UPDATE/DELETE triggers, so `/db assets search`
ranks by lexical match while embedding search ranks by semantic
similarity. The two paths combine in the same hybrid retrieval shape
documented under [Documents → Hybrid RAG](documents.md).

## Per-kind chunking strategy

Different asset kinds benefit from different chunk boundaries. The
strategy registry lives in `cfg.assets_chunking`:

| Kind | Available strategies | Default |
|---|---|---|
| Notebooks | `whole`, `cell`, `char_window` | `whole` |
| Queries | `whole`, `statement`, `char_window` | `whole` |
| Pipelines | `whole`, `char_window` | `whole` |
| Jobs, Streams, Streamlit | metadata-only (one chunk) | n/a |

Change strategies via `/db assets chunking` and re-embed with
`/db assets reindex`. For per-asset overrides (one notebook chunked
differently from the rest of the profile), use the **Chunk** button
on the Studio Browse → Assets row — see
[Studio Browse](../studio/browse.md#per-asset-chunking).

## Studio counterpart

Studio surfaces the same flow under Browse → Assets. The asset list
supports per-row preview, the **Chunk** button per row for per-asset
overrides, and selective ingest from the picker in the asset
ingestion wizard so you can pull just the notebooks you actually
care about instead of mirroring the entire workspace.

## Interaction with code RAG

Once ingested, notebook / query / pipeline source text flows into
the same code RAG index as files indexed by `/code-scan` (the local
code profile path). Searches across `/ask` and Studio Ask reach
both — there is no separate "remote code" namespace at retrieval
time. The default embedding model is
`jina-embeddings-v2-base-code` with a MiniLM fallback; see
[RAG architecture](../concepts/rag-architecture.md#code-rag) for
the model fallback chain.

## See also

- [Codebase](codebase.md) — local code-profile scanning; the
  source-text companion to remote assets.
- [Pages](../cli/pages.md) — the `notebook-walkthrough`,
  `job-runbook`, `pipeline-overview`, and `query-playbook` intent
  templates each consume one ingested remote asset.
- [Studio Browse](../studio/browse.md) — the GUI for everything on
  this page, with per-row chunking and selective ingestion.
- [Backends → Databricks](../backends/databricks.md),
  [Backends → Snowflake](../backends/snowflake.md) — connection
  setup for the two providers that ship remote-asset support.
