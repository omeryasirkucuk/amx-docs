# RAG architecture

AMX retrieves grounding evidence through three independent pipelines —
**Document RAG**, **Code RAG**, and **Catalog Search** — that share a
common four-layer shape: embed, chunk, retrieve, assemble.

Each pipeline answers a different question:

| Pipeline | Backing collection | What it answers |
| --- | --- | --- |
| **Document RAG** | `amx_docs` | "What do my ingested docs say about this column / report / concept?" |
| **Code RAG** | `amx_code` | "Where in the codebase is this column written, read, or transformed?" |
| **Catalog Search** | `amx_search_<profile>` | "Which tables / columns match this question?" — backs `/ask` and `/search`. |

The pipelines never see each other's chunks. They run in parallel and
their results meet at the orchestrator (see
[Architecture](architecture.md)).

## The four layers

```mermaid
flowchart LR
    Q[User question] --> Embed
    subgraph Pipeline
        direction LR
        Embed[Embedding layer] --> Chunk[Chunking]
        Chunk --> Retrieve[Retrieval + rerank]
        Retrieve --> Assemble[Prompt assembly]
    end
    Assemble --> LLM[LLM call]
```

### 1. Embedding layer

Pluggable per pipeline via [`/embeddings`](../cli/setup.md). Document
RAG and code RAG carry independent providers — `cfg.embedding_docs`
drives docs ingestion and `cfg.embedding_code` drives code RAG — so a
code-specialised encoder can power code retrieval while a prose-tuned
model serves the documentation side. Three provider kinds are
supported:

| Kind | When to use |
| --- | --- |
| `minilm` | Document RAG default; offline, fast, 384-dim, good baseline English retrieval. |
| `openai_compatible` | Any OpenAI-style `/embeddings` endpoint (OpenAI, Azure, vLLM, llama.cpp). Best quality for general English prose. |
| `sentence_transformers` | Local HuggingFace model. Used by the **code-specialised default** below and for any other custom embedder. |

Switch a side from the CLI with `/embeddings docs <kind>` or
`/embeddings code <kind>`, or from
[Studio → Settings → Embeddings](../studio/settings.md#embeddings).

**Defaults per pipeline:**

- **Document RAG** — MiniLM-L6-v2 (384-dim), bundled, zero-config.
- **Code RAG** — `jinaai/jina-embeddings-v2-base-code` (768-dim, ~161 MB,
  code-trained) when `sentence-transformers` is installed; falls back
  to MiniLM when it isn't. Identifier-heavy, snake_case, and CamelCase
  queries are measurably better on the code-trained encoder. Install
  the extra to opt in:
  ```bash
  pip install "amx-cli[local-embeddings]"
  ```
  Users without the extra get MiniLM plus a one-time WARNING in the
  log on first `/code search` naming the install command.
- **Catalog Search** — same as Document RAG (reads
  `cfg.embedding_docs`).

Each collection records its `embedding_provider`, `embedding_model`,
and `embedding_dim` in Chroma metadata on creation. Reopening with a
different identity raises `EmbeddingProviderMismatch` (Document RAG),
`CodeEmbeddingMismatch` (Code RAG), or `CollectionIdentityMismatch`
(Catalog Search) — never silent re-embedding. Recovery commands per
pipeline: `/docs reindex`, `/code-refresh`, `/search rebuild`.

### 2. Chunking

Document RAG dispatches by file extension via
`amx.docs.splitters.get_splitter`:

| Extension | Splitter | Notes |
| --- | --- | --- |
| `.md` / `.markdown` | Markdown-header-aware (two-stage) | Splits by `#`/`##`/`###` headers; records heading path on each chunk's `h1`/`h2`/`h3` metadata. Long sections are further chunked to fit the budget; header metadata propagates onto every sub-chunk. The heading line stays in the chunk body so the LLM sees the structure too. |
| `.txt`, `.pdf`, `.csv`, `.docx`, `.html`, `.py`, ... | `RecursiveCharacterTextSplitter` | Default. Structural separator hierarchy `["\n\n", "\n", ". ", " ", ""]` — paragraph → line → sentence → word → character. 1000 chars per chunk, 200-char overlap. |
| Unknown extension | Default (fallback) | Never raises `KeyError`. |

The header metadata is the channel prompt assembly uses for
citation strings ("`orders.md → h2: total_amount`") —
see [Prompt assembly](#4-prompt-assembly) below. Chunks from
non-Markdown extensions never have `h1`/`h2`/`h3` keys; downstream
code that reads them treats absence as "no structural hint
available."

Code RAG is **AST-aware** for Python: one chunk per function or
class, with `start_line` and `end_line` preserved so citations point
at the exact lines. Jupyter notebooks chunk one cell at a time.
Other source languages fall back to a 4000-character recursive
splitter.

Catalog Search does not chunk in the document sense — each catalog
entity (a table or column) is its own "chunk" with structured
metadata.

**Per-kind chunking for ingested remote code assets.** Notebooks,
queries, pipelines, jobs, streams, and Streamlit apps from
Databricks and Snowflake (see
[Remote code-asset ingestion](../data-sources/remote-code.md))
each have their own strategy registry under `cfg.assets_chunking`:

| Asset kind | Available strategies | Default |
|---|---|---|
| Notebooks | `whole`, `cell`, `char_window` | `whole` |
| Queries | `whole`, `statement`, `char_window` | `whole` |
| Pipelines | `whole`, `char_window` | `whole` |
| Jobs, Streams, Streamlit | metadata-only (one chunk) | n/a |

`whole` produces one chunk per asset — coarse but predictable and
the safest default for assets that lean on global context (a
pipeline's whole-DAG semantics, a notebook's narrative). `cell`
slices a notebook by Jupyter cell. `statement` slices a SQL
query by `;` boundary. `char_window` is the pure character-window
fallback for cases where neither structural strategy makes sense.

Per-asset overrides land on the same registry keyed by asset id —
the Studio Browse → Assets row-level **Chunk** button writes the
override and triggers a re-embed (see
[Studio Browse → Per-asset chunking](../studio/browse.md#per-asset-chunking)).

### 3. Retrieval + rerank

| Pipeline | Vector | Lexical | Fusion | Rerank | Diversity |
| --- | --- | --- | --- | --- | --- |
| Document RAG | Chroma cosine, top-k over-fetched to `max(k, min(4k, 40))` | SQLite FTS5 (BM25), Porter unicode61 tokeniser, same top-k pool | Reciprocal Rank Fusion (k=60) over the two channels | Heuristic (default): `distance + token_overlap + explanatory_terms − header_penalty`. Opt-in: cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2` ~80 MB, English) or `BAAI/bge-reranker-v2-m3` (~568 MB, multilingual) when `cfg.docs.rerank.kind` is set. | MMR (λ=0.7) over the reranked pool, demotes near-duplicate chunks |
| Code RAG | Chroma cosine, top-k over-fetched | Identifier-token overlap | Additive weighted | `distance + 2.5 × keyword_overlap` | — |
| Catalog Search | Chroma cosine per profile | SQLite FTS5 (BM25) | Additive weighted | Hybrid + source-kind weighting (manual ≫ reviewed ≫ generated) + confidence bonus | — |

The opt-in cross-encoder rerank requires
`pip install "amx-cli[local-embeddings]"`. It replaces the
heuristic when active; on any failure (extra not installed, model
download blocked, prediction error) it logs a structured warning
and returns the heuristic's ordering unchanged. The cross-encoder
is a quality *upgrade*, never a single point of failure.

For Document RAG specifically: every Chroma upsert mirrors the same
chunk into a SQLite FTS5 sidecar at
`<persist_dir>/docs_fts.sqlite`. Returning users get hybrid
retrieval on next `RAGStore` open via a one-time backfill that
seeds the FTS table from existing Chroma chunks; no manual reindex
required. Queries that produce no alphanumeric tokens (or hit a
sidecar error) fall back to vector-only — backward-compatible.

The Catalog Search path also runs a two-pass LLM **query planning**
step that classifies the question (`question_class`), surfaces entity
hints, and may translate a non-English question into English search
queries before retrieval.

### 4. Prompt assembly

The RAG Agent assembles the retrieved chunks into the user message
sent to the LLM through three steps:

1. **Truncate + edges-first reorder.** Chunks arrive in descending
   relevance from rerank. `assemble_chunks(chunks, k)` takes the
   top-k and reorders them so the highest-relevance chunks anchor
   *both* ends of the prompt — `[c1, c3, c5, c6, c4, c2]` for
   `k=6` — pushing mid-scorers into the attention-dead middle.
   This combats the "Lost in the Middle" failure documented in
   Liu et al. (2023). `k` is `rag_max_chunks` (configurable per
   [prompt-detail preset](../cli/run-and-apply.md): 5 / 8 / 12 / 15).

2. **Citation header per chunk.** Every chunk body gets a
   one-line prefix:
   ```
   [orders.md | section=total_amount] (rel=1.34)
   <chunk body>
   ```
   The header reads `source.basename` + `h2`/`h3`/`h1` from chunk
   metadata (produced by the Markdown-aware splitter) and the
   rerank score. Plain-text chunks degrade gracefully to
   `[plain.txt]`. The header gives the LLM a scannable summary
   even when attention is weakest mid-prompt and gives downstream
   citation extraction a stable channel to mine.

3. **Per-model input budget.** The input window is the smaller of
   `litellm.get_model_info(model)["max_input_tokens"] - output - 256`
   (real per-provider window) and the legacy `max(1000, max_tokens * 3)`
   heuristic (used as a fallback for unknown / proxy models). Stops
   AMX from over-stuffing a small-context Mistral or under-using a
   200k-token Claude.

Per-chunk extractive compaction (first ~1200 characters + last
~300 characters of each chunk) still runs after these steps when
the assembled context still exceeds the budget — that part is
unchanged.

## Defaults at a glance

| Knob | Default | Where to change |
| --- | --- | --- |
| Docs RAG embedder (`cfg.embedding_docs`) | `minilm-l6-v2` | `/embeddings docs <kind>` |
| Code RAG embedder (`cfg.embedding_code`) | `jinaai/jina-embeddings-v2-base-code` if `amx-cli[local-embeddings]` is installed; else `minilm-l6-v2` (with one-time warning) | install the extra, or `/embeddings code <kind>` |
| Catalog Search embedder | reads `cfg.embedding_docs` | `/embeddings docs <kind>` |
| Docs chunk size / overlap | 1000 chars / 200 chars | hardcoded today; configurable in the chunking roadmap |
| Code chunk strategy | AST for Python, 4000-char for other code | hardcoded |
| Top-k retrieved | 5 | `/docs search --results N` for ad-hoc; preset-driven for `/run` |
| Chunks fed to LLM | 8 (default preset) | prompt-detail preset |

## Tuning recommendations

- **English prose corpora**: default MiniLM is fine. For higher
  quality without leaving offline, switch to `bge-small-en-v1.5` via
  `/embeddings docs local BAAI/bge-small-en-v1.5` (the docs side; the
  code side is independent).
- **Code-heavy corpora**: install `amx-cli[local-embeddings]` to
  pick up the code-specialised default. Already opted in if you
  installed the extra — Code RAG uses it automatically with no
  config change.
- **Long-form questions**: bump `rag_max_chunks` via the
  `detailed` / `full` prompt preset.

## Future tuning

The retrieval architecture above is considered complete for AMX's
English-only data-catalog use case. Each retrieval-quality change
shipped against the
[retrieval evaluation harness](../evaluation/retrieval-eval.md) —
the committed baseline (`hit@3 = 0.85`, `hit@5 = 0.95`, `MRR = 0.78`)
is the floor every subsequent change must clear.

A small number of low-priority follow-ups remain available on the
dispatcher seam for users with corpora that exercise them:

- **Token-counted chunk budgets.** The default splitter still
  counts characters; switching to `tiktoken`-based length functions
  aligns chunk sizing with the LLM context budget downstream.
- **`cfg.docs.chunking` config knobs.** Chunk size, overlap, and
  strategy are hardcoded today; exposing them would let users with
  code-heavy or PDF-heavy corpora tune without forking.
- **Chunker signature in collection metadata.** A sibling of the
  embedding-identity check that forces a reingest when the chunker
  config changes.
- **Format-specific splitters for `.py` / `.csv` / `.pdf`.** Reuse
  the existing AST chunker for `.py` files entering via
  `/docs ingest`; row-group splitter for CSV; layout-aware PDF.

Two larger ideas were explicitly evaluated and dropped:

- **Query rewriting + metadata filters.** Aimed at synonym /
  terminology gaps and non-English → English-corpus translation.
  AMX's data-catalog scope is English-only by design; adding an
  LLM call to every retrieval (+500-2000 ms per query) for a
  problem AMX doesn't have is the wrong trade-off.
- **Shared retrieval-core refactor.** Pure refactor whose payoff
  is amortised across future retrieval PRs. With the rollout
  complete and no new retrieval features planned, the refactor
  has no payback window.
