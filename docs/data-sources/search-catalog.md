# Search catalog

AMX maintains an internal `/search` catalog inside the local SQLite history database
(`~/.amx/history.db`). It stores everything `/ask` needs to answer questions without going
back to the database for every detail.

## What the catalog stores

- Effective metadata state per database / schema / table / column (the description that
  would be applied if you ran `/apply` right now).
- Generated, reviewed, manual, imported, and rejected description candidates.
- FK and inferred relationships.
- Normalised code-usage evidence from `/code scan`.
- Sync / rebuild job history.
- Per-profile `/search` settings.

The catalog **is not the database**. It's a derived view of what AMX has learned.

## Sync behaviour

The catalog stays fresh through several auto-update points:

- `/analyze run` and `/run-apply` automatically persist generated alternatives and refresh
  the catalog.
- `/history review` mirrors accepted / custom / skipped decisions into the catalog.
- `/metadata edit` writes a `manual` catalog description immediately.
- `/code scan` refreshes code-usage evidence.
- `/search rebuild` recomputes effective state and rebuilds the `amx_search` Chroma vector
  index.

Manual sync is rarely needed:

```text
/search status                           # what's in the catalog now
/search sources                          # which evidence sources are enabled
/search sync                             # full re-sync from DB + cached code evidence
/search sync --schema sap_s6p            # narrow scope
/search sync --table sap_s6p.t001
/search rebuild                          # rebuild effective state + vector index
```

Use `/search sync` mainly when:

- An external tool (DBT, dbt-docs, an admin UI) changed comments in the database
  underneath you.
- You ingested a new tranche of documents and want their evidence included in `/ask`
  results immediately.

## The `amx_search` vector index

Behind the catalog sits a Chroma vector index at `~/.amx/chroma/amx_search/`. Each row
embeds:

- The fully-qualified identifier (`schema.table.column`).
- The current effective description.
- Adjacent context (table comment, neighbouring columns).

The index is what powers semantic `/ask` queries like "tables that store address data".
Lexical / structural / live evidence still takes precedence — vector search is the
fallback when name-matching doesn't hit.

## Tuning `/search`

```text
/search config                           # show all settings for the active DB profile
/search config max_neighbors 8           # update one
/search context-detail rich              # control how much catalog/code/history context goes in
```

Settings are stored per DB profile.

| Key | Default | Description |
|---|---|---|
| `max_neighbors` | `5` | Top-K for vector retrieval |
| `context_detail` | `standard` | Catalog/code/history context budget (`minimal` / `standard` / `rich` / `deep`) |
| `enable_live_verify` | `true` | Run safe live DB probes for high-risk structural claims |
| `enable_action_loop` | `true` | Allow `--actions` to suggest follow-up actions |
| `min_score_floor` | `0.05` | Suppress low-confidence tail rows |

## Embeddings provider

```text
/embeddings              # show current
/embeddings MiniLM       # default, offline (no extra install)
/embeddings OpenAI-compatible openai/text-embedding-3-small
/embeddings Local        # local sentence-transformers (requires amx[local-embeddings])
```

Run `/search rebuild` after switching — the catalog needs to be re-embedded so the new
provider's vectors are used at retrieval time.

## Catalog vs database — what wins

When `/ask` answers a question, AMX prefers explicit/live evidence over semantic fallback:

1. **Live DB probe** for table-scoped factual questions ("how many columns does ADRC have?",
   "are all ADRC columns commented?") — these run safe metadata probes before answering.
2. **Catalog facts** (effective metadata state, FK relationships, code references) — used
   when the question is broad or doesn't benefit from a probe.
3. **Vector retrieval** as an independent fallback when lexical terms don't match.

Synthesised answers receive the visible grounded result set, but `/search` suppresses
low-confidence tail rows before answering so weak vector-only matches don't dominate the
user-facing summary.

## Recovery

The catalog rebuilds from the database in one command:

```text
/search rebuild
```

This re-reads DB metadata, replays cached code evidence, and re-embeds. Useful when:

- The Chroma directory is corrupted.
- You've upgraded AMX past a schema bump and want a clean rebuild.
- You changed embeddings and want consistent vectors across the catalog.

The local SQLite history is the source of truth for run results — `/search rebuild`
does not touch it.
