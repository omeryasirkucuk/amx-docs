# `/ask` and `/search`

`/ask` is conversational metadata Q&A grounded on AMX's internal search catalog. Use it to
explore a database without writing SQL — "which tables store address data?", "how many
columns does ADRC have?", "what joins ORDERS to CUSTOMERS?".

## How `/ask` differs from `/run`

| `/run` | `/ask` |
|---|---|
| Generates new descriptions | Answers questions over existing metadata |
| Multi-agent + write-back | Single Search Agent, read-only |
| Per-column LLM calls | One LLM call per question (multi-step internally) |
| Output: reviewed descriptions | Output: prose + grounded result table |

## Asking questions

```text
/ask which tables in sap_s6p store dates?
/ask how many columns does adrc have?
/ask what is the ADRC table?
/ask satır sayısı en fazla olan tablo hangisi          # works in any language
/ask top 5 tables by row count
/ask what joins orders to customers?
```

The Search Agent answers in the same language as the question.

### Answer shapes

The interpretation pass classifies each question into one of seven explicit answer shapes:

| Shape | Example | What you get |
|---|---|---|
| `single_fact` | "which table has the most rows?" | One sentence headline |
| `short_table` | "top 5 tables by row count" | 2–5 row markdown table |
| `full_table` | "list all tables in sap_s6p with row counts" | Full table |
| `ranked_list` | "tables most likely to contain addresses" | Ordered list |
| `table_summary` | "what is the ADRC table?" | Multi-paragraph summary |
| `join_candidates` | "what joins orders to customers?" | FK + heuristic candidates |
| `prose` | "explain the relationship between sales and finance schemas" | Free-form |

The bottom-of-output **Search matches** table is suppressed for inventory and prose answers
(where the headline already carries the data) and filters out rows whose score is exactly
`0.00`. Inventory rows render in a dedicated `Schema | Table | Columns | Rows | Cluster`
table when shown.

### Grounded retrieval

For each question, the Search Agent runs a multi-step pipeline:

1. **Interpretation.** Classify intent + answer shape + scoping (specific table vs broad
   discovery).
2. **Retrieval planning.** Choose between the SQLite catalog, the `amx_search` vector index,
   or live DB introspection.
3. **Grounded retrieval.** Fetch evidence from the chosen source(s).
4. **Live verification.** For high-risk structural claims (column count, nullability, comment
   coverage on a specific table), run safe read-only DB probes.
5. **Synthesis.** Produce the answer using the grounded evidence and pick suggested follow-up
   actions.

`--debug` reveals the planner's Thought Trace and adds raw `Score` / `Source` / `Conf`
columns to the result table. `--verbose` is an alias.

### Live verification

Table-scoped factual questions are **live-first**: questions like "what is the ADRC table?"
or "are all ADRC columns commented?" resolve the requested table and run safe live metadata
probes before answering structural facts. Open-ended semantic column searches like "city
related column names" stay on catalog/vector retrieval unless you scope them to a table.

Explicit table mentions (`schema.table`, `ADRC table`, `adrc tablosunda`) take precedence
over fuzzy catalog matches. If the exact live table cannot be verified, AMX **refuses to
substitute a similar candidate** like `ADR6`; fuzzy matches are shown only as suggestions.

`/search` only labels an answer as **live verified** when live metadata rows were actually
collected; catalog-only or fuzzy evidence is capped at lower confidence.

### Approved actions (`--actions`)

```text
/ask --actions which tables are missing column comments?
```

`--actions` turns selected suggestions from the answer into a human-approved execution loop.
AMX asks before running:

- catalog sync
- cached code-evidence refresh
- single-table metadata analysis (a focused `/run`)

Each action outcome is recorded in history.

## Sessions

Every `/ask` appends to a persistent session in `~/.amx/history.db`. Follow-ups remember
prior turns even after `/exit` and restart:

```text
/ask which tables store address data?
/ask any others?
/ask what about its columns?
```

When a session's live token estimate exceeds ~40% of the model's input budget, AMX
summarises the oldest slice with a single LLM call (Claude / Gemini / OpenAI / DeepSeek)
and replaces it with a synthetic summary turn so follow-ups still ground against compacted
history. Falls back to a stub when no LLM is available.

### Managing sessions

```text
/session new "ADRC investigation"          # start fresh, pin as active
/session list -n 10                        # recent sessions in this DB profile
/session list --all-profiles               # across every DB profile
/session resume <id>                       # switch active session pointer
/session show --include-compacted          # full per-turn audit trail
/session end                               # close the current session
```

New REPL boots always start fresh — opt back in via `/session resume`.

`/session resume` refuses cross-profile resume so a session belonging to `prod_pg` won't
be re-attached to `dev_snowflake` by mistake.

## Catalog management

`/ask` reads from the AMX search catalog inside `~/.amx/history.db`. Keep it fresh:

| Command | When to use |
|---|---|
| `/search status` | Show catalog counts, freshness, and recent sync jobs |
| `/search sources` | Enabled search settings and evidence-source coverage |
| `/search sync [--schema …] [--table …]` | Sync DB structure / comments and cached code evidence |
| `/search rebuild` | Recompute effective state and rebuild the `amx_search` vector index |
| `/search embeddings [kind] [model]` | Switch embedding provider (`MiniLM` / `OpenAI-compatible` / `Local`) |
| `/search context-detail [minimal\|standard\|rich\|deep]` | Catalog/code/history context budget |

`/run`, `/run-apply`, `/history review`, and `/metadata edit` all auto-update the catalog —
manual `/sync` is mostly needed when an external tool changed the database underneath you.

After switching embeddings, run `/search rebuild` to re-embed the catalog.

## Configuration

```text
/search config                             # show all /search settings for the active DB
/search config max_neighbors 8             # update one
```

Settings are per-DB-profile. See [Search catalog](../data-sources/search-catalog.md) for
what's tunable.

## Failure semantics

- If no active LLM profile exists, `/ask` fails closed and tells you to configure `/llm`.
- Inventory/count questions use **live DB introspection** so they remain correct even when
  only part of the catalog has generated descriptions.
- Aggregate answers avoid dumping the generic schema/table/column result grid when that
  grid would be irrelevant to the user question.
- The interpreter is conservative about follow-up scope, ambiguity, and enum selection —
  it prefers asking for clarification over guessing.
