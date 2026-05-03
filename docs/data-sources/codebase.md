# Codebase

The Code Agent reads your application code looking for references to tables and columns,
then surfaces the most relevant snippets to the LLM. The signal-to-noise on this is high —
how a column is used in code is often the clearest evidence of what it actually means.

## Adding a codebase profile

```text
/code
/add-code-profile etl_repo
```

The wizard asks for:

- **Name** — used to switch with `/use-code <name>`.
- **Path** — local directory or Git URL.
- **Languages** — defaults to all detected; restrict if you want.

```yaml
code_profiles:
  etl_repo:
    paths:
      - ~/work/company-etl
    include_extensions: [py, sql, java, scala]
    exclude_globs:
      - "**/node_modules/**"
      - "**/.venv/**"
      - "**/dist/**"
```

Multiple paths are supported — the agent treats them as one logical codebase.

## Supported sources

- **Local directories.**
- **GitHub repositories** — `https://github.com/owner/repo` or `git@github.com:owner/repo.git`.
  Cloned into a temporary directory only for the active scan, then removed after AMX
  finishes reading and indexing them.

## Supported languages

The literal-reference scan handles every text file. The semantic chunker handles Python by
function/class span and other languages by paragraph-style splits. Languages with
particularly high-quality output:

- Python — function and class spans
- SQL — statement-level (with `sqlglot` from `amx[code-intel]` for richer parsing)
- Java / Scala / Kotlin — class span, decent
- Go / TypeScript / JavaScript — paragraph split, decent
- Anything else — paragraph split, weaker signal

## Two scan mechanisms

1. **Literal reference scan.** Walks the tree, captures occurrences of identifiers in their
   source context (function name, file path, surrounding lines). Cached on disk per
   profile.
2. **Semantic code RAG.** Chroma collection `amx_code` holds embedded chunks. The Code
   Agent queries by table/column name and feeds the nearest neighbours into the LLM
   prompt.

Chunks are tagged by source path and the agent **filters retrieval to the active code
profile** so a multi-repo machine doesn't bleed snippets from one project into another.

## Running scans

```text
/code-scan                    # active profile
/code-scan --code-profile other_repo
/code-scan some/specific/path
```

Output: a manifest at `~/.amx/code_cache/<slug>/` plus the `amx_code` Chroma collection.

```text
/code-results                 # show last cached scan results
/code-refresh                 # invalidate cache + Chroma chunks
```

`--code-refresh` on `/run` does the same in a single step:

```text
/run sap_s6p --code-refresh
```

## What lands in `amx_code`

For Python, AMX extracts function and class spans verbatim — the model sees the whole
function body when it asks "how is `audat` used?".

For other languages, AMX falls back to text-splitter chunking. The chunk size is tuned for
SQL files (each statement gets its own chunk where possible).

Every chunk carries metadata:

- `source_path` (relative to the scan root)
- `language`
- `chunk_kind` (`function`, `class`, `text`, `sql_statement`)
- `code_profile` (so retrieval filters cleanly)

## Identifiers outside the connected DB

Strings that look like catalog objects but aren't in the connected table list appear as
**secondary context** for the LLM. For example, an ETL script that references both
`sap_s6p.t001` (in your DB) and `external_lake.partner.orders` (not in your DB) is useful
context because the partner table's name and column references sometimes hint at semantics
of the connected one.

These secondary references are clearly labelled in the Code Agent prompt so the LLM weights
them appropriately.

## Standalone Code Agent

```text
/code-analyze sap_s6p.t001
```

Runs the Code Agent in isolation — useful for testing prompts or producing
codebase-only descriptions without paying for the full multi-agent pipeline. The
suggestions land in the same staging area as `/run`, so a follow-up `/run` picks them up
without re-querying the LLM.

## Cost knobs

- `/code-results` first — see what AMX already has cached before re-scanning.
- `--code-refresh` only when the tree has changed.
- Restrict `include_extensions` to languages you care about.
- Use `exclude_globs` aggressively — `node_modules`, `.venv`, `dist`, `target`, build
  output should never be indexed.

## Limits

- The semantic code RAG is **assistive, not a proof of dataflow**. AMX does not do whole-program
  analysis. Wide schemas use **capped** table/column lists for performance.
- Generated code (e.g. SQLAlchemy auto-generated migration files) is included by default —
  consider excluding via `exclude_globs` if it dilutes the signal.
- Very large repos (10M+ lines) take a while to scan the first time. Subsequent runs hit
  the cache.
