# Search catalog

AMX maintains an internal search catalog that combines three things — the database
catalog (tables, columns, descriptions), the document RAG index (PDFs, Word, Markdown),
and the code reference index (extracted snippets) — into a single embedding store.
That's what `/ask` queries to answer your questions, what `/run` consults for context
when drafting descriptions, and what `/search` exposes directly. This page walks
through how the catalog is built, when to `/sync` vs `/rebuild`, and how to recover
from corruption or model-mismatch errors.

## Prerequisites

- AMX installed.
- An active DB profile (introspected at least once — `/sync` will do it).
- Optionally, an active doc and / or code profile.
- An active LLM profile (used for the embedding step).

## How the catalog is built

```
┌──────────────────────────────────┐
│   /sync                          │
├──────────────────────────────────┤
│   1. Refresh introspection cache │   ← from DB profile
│   2. Embed new / changed entries │   ← LLM profile (embedding model)
│   3. Update Chroma index         │
│   4. Reconcile with audit trail  │   ← from /history
└──────────────────────────────────┘
              │
              ▼
   ~/.amx/chroma/  ← single Chroma directory; per-collection inside
              │
              ▼
       /ask, /search, /run (RAG context)
```

Three collections live inside `~/.amx/chroma/`:

| Collection | Source | Refreshed by |
|---|---|---|
| `db_catalog` | DB tables, columns, existing comments | `/sync` |
| `documents` | RAG doc profile | `/ingest` |
| `code_refs` | Code agent profile | `/code-scan` |

`/ask` searches across all three and merges results.

## Step-by-step

### 1. Initial sync

```text
> /search status
Search catalog: empty (never synced)

> /sync
[1/4] Refreshing introspection cache .........  ok (47 tables, 1,283 columns)
[2/4] Embedding 1,330 entries ................  ok (8.4 s, $0.012)
[3/4] Updating Chroma index ..................  ok
[4/4] Reconciling with description audit .....  ok (0 prior /apply runs)
✓ /sync finished. Catalog ready for /ask.
```

The first sync against a fresh DB takes a moment — one embedding call per table +
column. With `text-embedding-3-small` at OpenAI's price, a 1,300-entry warehouse
embeds for ~$0.01.

### 2. Incremental sync

After the first sync, re-running is cheap — only entries with changed names or
descriptions are re-embedded:

```text
> /sync
[1/4] Refreshing introspection cache .........  ok (47 tables, 1,283 columns)
[2/4] Embedding 12 changed entries ...........  ok (0.8 s, $0.0001)
[3/4] Updating Chroma index ..................  ok
[4/4] Reconciling with description audit .....  ok (3 new /apply runs since last sync)
✓ /sync finished in 1.4 s.
```

Run `/sync` after every `/apply` so descriptions you just wrote are immediately
searchable.

### 3. Search the catalog

```text
> /search "customer addresses"
Top-8 results across all collections:
  0.142  [db_catalog]  sales.customer_address (table)
  0.198  [documents]   data-glossary/address.md p.1
  0.214  [code_refs]   models/marts/customer.sql:42
  ...
```

The `[db_catalog]` / `[documents]` / `[code_refs]` tag tells you which collection a
hit came from. Useful when retrieval looks off — you can immediately tell whether the
LLM was relying on the DB or the docs.

### 4. Status check

```text
> /search status
Search catalog
  db_catalog: 1,330 entries (last /sync 4 min ago)
  documents:    412 chunks  (last /ingest 1 hour ago)
  code_refs:    412 chunks  (last /code-scan 23 min ago)
Embedding model: openai/text-embedding-3-small
Index store: ~/.amx/chroma  (size: 18.4 MB)
```

If any of the three lines say `(never indexed)`, run the corresponding command:
`/sync` for db_catalog, `/ingest` for documents, `/code-scan` for code_refs.

### 5. Full rebuild

```text
> /search rebuild
About to wipe ~/.amx/chroma and re-embed:
  db_catalog: 1,330 entries
  documents:  412 chunks
  code_refs:  412 chunks
  Estimated cost: $0.025

Proceed? [y/N]: y

[1/3] Wiping index ...................  ok
[2/3] Re-syncing db_catalog ..........  ok (8.1 s)
[3/3] Re-ingesting documents .........  ok (5.4 s)
[4/3] Re-scanning code_refs ..........  ok (6.0 s)
✓ /search rebuild finished in 19.5 s.
```

`/search rebuild` is the right move when:

- You changed the embedding model in `~/.amx/config.yml` (cosine distances become
  meaningless across models).
- The Chroma directory got corrupted (rare but happens with abrupt power loss).
- You moved AMX to a different config dir and want a fresh index.

## When to `/sync` vs `/rebuild`

| You did this | Then run |
|---|---|
| `/apply` (wrote descriptions back to the DB) | `/sync` |
| Added a new column / table on the DB | `/sync` |
| Edited `~/.amx/config.yml` to add a doc path | `/ingest` |
| Edited the codebase | `/code-scan` |
| Changed `embedding_model:` in YAML | `/search rebuild` |
| `~/.amx/chroma/` got deleted / corrupted | `/search rebuild` |
| Switched to a different DB profile | `/sync` (catalog is per-profile) |

## Sample config

```yaml
search:
  embedding_model: openai/text-embedding-3-small
  top_k: 8
  index_store: ~/.amx/chroma
```

For larger / more nuanced catalogs, switch to `openai/text-embedding-3-large` (about
3× the cost, noticeably better retrieval on technical jargon) and run
`/search rebuild`.

## Verify

1. `> /search status` — entry counts per collection, last-update timestamp, embedding model identity, on-disk size.
2. `> /search "<a phrase you indexed>"` — confirms retrieval works at all.
3. `> /ask "<a question with a known answer>"` — end-to-end test of retrieval + LLM answer.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/search status` shows the catalog but `/ask` says "I don't know" for everything | Embedding-model mismatch (you changed model in YAML, didn't rebuild) | `> /search rebuild` |
| Chroma error on startup: `chromadb.errors.InvalidCollectionException` | Index dir corrupted | `rm -rf ~/.amx/chroma` and `> /search rebuild` |
| `/sync` fails with `OpenAI quota exceeded` | Free-tier embedding quota for the day exhausted | Wait, raise the quota tier, or switch to `text-embedding-3-small` (cheaper) |
| Index dir size keeps growing forever | `/search rebuild` not run since several model swaps; orphan collections accumulate | `rm -rf ~/.amx/chroma` and `> /search rebuild` once |
| Searches return only `db_catalog` results, never docs | Doc profile not active | `> /use-doc <name>` then re-run `/ask` |
| `/sync` takes 10+ minutes on a small warehouse | Network round-trip to the embedding API per call | Use a batched embedding model (the OpenAI client batches automatically); confirm `OPENAI_API_BASE` isn't pointing at a slow proxy |
