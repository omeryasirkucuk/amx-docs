# Documents

The RAG Agent reads your documentation — PDFs, Word docs, Markdown handbooks, Excel
data dictionaries — and feeds the relevant chunks to the LLM as evidence when drafting
column descriptions. A column whose name is a cryptic abbreviation suddenly becomes
documentable when the team's onboarding PDF defines what the abbreviation means. This
page walks through registering a doc profile, ingesting files into the RAG index,
searching the index, and recovering when results come back empty.

## Prerequisites

- AMX installed.
- A folder, file, or list of files you want indexed (PDF / DOCX / MD / TXT / XLSX supported).
- An active LLM profile (used for the embedding step, then for the answer step in `/ask`).

## Step-by-step

### 1. Register a document profile

```text
> /add-doc-profile
Profile name: data-handbook
Paths (one per line, blank to finish):
  /Users/me/Documents/data-platform-handbook.pdf
  /Users/me/Documents/data-warehouse-runbook.docx
  /Users/me/internal-docs/data-glossary/
[blank to finish]:
✓ Registered doc profile 'data-handbook' (3 source paths)
```

Folders are walked recursively for the supported extensions. Mix files and folders
freely; AMX deduplicates internally.

### 2. Ingest the files

```text
> /ingest
[1/4] Walking sources ...........................  ok (3 paths, 47 files discovered)
[2/4] Extracting text ...........................  ok (1.4M chars across 47 files)
[3/4] Chunking ..................................  ok (412 chunks, 800-1200 tokens each)
[4/4] Embedding (openai/text-embedding-3-small)..  ok (412 chunks, $0.012, 6.2 s)
✓ /ingest finished. Profile 'data-handbook' is ready for /ask and /run RAG.
```

Chunks are stored in the same Chroma store as the database catalog (see
[Search catalog](search-catalog.md) for the full data flow). Each chunk keeps its
source path + page number so citations resolve to the original file.

### 3. Inspect what got chunked

```text
> /scan
Profile: data-handbook (active)
3 source paths · 47 files · 412 chunks · 1.2 MB embeddings

Chunks by source:
  data-platform-handbook.pdf       142 chunks (pp. 1–47)
  data-warehouse-runbook.docx       89 chunks
  data-glossary/                   181 chunks across 28 files

Top topics (from chunk titles):
  - "Customer Master — definition" — 12 chunks
  - "Order lifecycle" — 18 chunks
  - "Revenue recognition policy" — 9 chunks
```

If a topic you'd expect is missing, the file probably wasn't picked up — see "Empty
search results" below.

### 4. Search the index directly

```text
> /search-docs "what does x_legacy_status mean"
Top-5 results (cosine distance):
  0.184  data-platform-handbook.pdf:p.34   "Legacy status mapping"
         "Status values 1–7 map to the v3 system's customer state machine. 1=active,
          2=pending, 3=frozen, 4=dormant, 5=closed, 6=fraud, 7=migration-pending. The
          mapping is preserved in marts/customer.sql for backward compat..."

  0.224  data-glossary/customer.md          "Status flags"
         "x_legacy_status (deprecated since v4) — see legacy mapping in handbook §4.2."

  ...
```

`/search-docs` is the lower-level command — `/ask` runs the same retrieval and then
asks the LLM to answer using only the retrieved chunks.

### 5. Run with doc evidence

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok
[RAG]     6 of 18 columns matched documentation chunks; embedding ... ok
[Code]    no code profile active — skipping
[LLM]     drafting 18 column descriptions with doc evidence ... ok
          confidence: high 17 · medium 1 · low 0
```

Compare to the same `/run` without the doc profile active — columns whose names match
glossary entries jump straight to `high` confidence.

## Empty search results — the recovery path

```text
> /search-docs "retention policy"
No results for 'retention policy'.

Possible reasons (in order of likelihood):
  1. The phrase isn't in any indexed chunk. Try a broader query or check /scan.
  2. The relevant file isn't indexed. /scan lists files; add the missing path with /add-doc-profile.
  3. The chunk size is too small for the phrase to appear in one chunk. Tune /ingest --chunk-size.
  4. Embedding-model mismatch since last /ingest. Run /ingest --rebuild.
```

For each case:

- **Case 1** — re-phrase. Embeddings match concepts, not exact strings, but a very
  abstract query still needs at least *some* lexical anchor.
- **Case 2** — `/scan` lists every indexed file. If your retention policy lives in an
  unincluded folder, `/add-doc-profile` extends the profile and `/ingest` picks up the
  new files (only the new ones — incremental).
- **Case 3** — by default chunks are 800–1200 tokens. For documents where one concept
  spans many pages, raise `chunk_size` in YAML; for terse glossaries, lower it.
- **Case 4** — when you change the embedding model, the existing index can't be queried
  with the new model. `/ingest --rebuild` drops and re-embeds everything.

## Sample config

```yaml
doc_profiles:
  data-handbook:
    paths:
      - /Users/me/Documents/data-platform-handbook.pdf
      - /Users/me/Documents/data-warehouse-runbook.docx
      - /Users/me/internal-docs/data-glossary/
    chunk_size: 1000          # tokens
    chunk_overlap: 100        # tokens overlap between adjacent chunks
    extensions: [".pdf", ".docx", ".md", ".txt", ".xlsx"]
active_doc_profile: data-handbook
```

## Verify

1. `> /scan` — confirms files / chunks counts and top topics.
2. `> /search-docs "<known phrase>"` — confirms retrieval works for a phrase you definitely indexed.
3. `> /run <table> --debug | grep RAG` — confirms the RAG agent ran and contributed evidence.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/ingest` skips PDFs silently | `pypdf` (or the chosen PDF lib) couldn't parse — encrypted / scanned-image PDF | OCR the PDF first, OR `/ingest --debug` to see the per-file failures |
| `/search-docs` returns garbage on a specific phrase | Embedding model is too small for technical terms | Switch to `text-embedding-3-large` and `/ingest --rebuild` |
| Citations point to the wrong page in a PDF | PDF has unusual page numbering (front matter unnumbered) | Cosmetic — citations use the absolute page number; cross-check against the file's TOC |
| `/ingest` is slow on every run | Source folder is on a network mount with high stat() latency | Move sources locally or to a faster mount; AMX touches every file's mtime to decide what to re-ingest |
| Out-of-disk after several rebuilds | Chroma index isn't garbage-collected on incremental rebuilds | `/ingest --rebuild` (drops the old index) or `rm -rf ~/.amx/chroma` and re-`/ingest` |
| `/ask` answer doesn't use the docs even though they're indexed | Active doc profile isn't the one ingested | `> /use-doc data-handbook` then `> /ask …` |

## What's next

- [Codebase data source](codebase.md) — pair docs with code references for highest description quality.
- [Search catalog](search-catalog.md) — how docs / code / catalog all sit in the same Chroma index.
- [Ask & Search](../cli/ask-and-search.md) — `/ask` over your documents.
