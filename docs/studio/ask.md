# Ask

`/ask` is the chat surface for asking metadata questions. It reads from
the DB profile catalog, the document RAG index, and the codebase RAG
index, and threads its answers with tool-call traces so you can audit
how an answer was reached.

## Sessions

The left sidebar (above the chat on mobile, side-by-side on `md:` and
up) holds the **Sessions** list.

- **+ New session** creates a fresh chat with the default scope.
- Each existing session row shows a title (auto-named from the first
  question, or manually renamed), the last-active timestamp, and a
  delete button.
- Click a row to resume the conversation. The agent replays the prior
  4 question/answer turns into its context so follow-ups like "the
  second one" resolve without re-explaining.
- An **End session** control closes the current chat (it stays in the
  list, but the agent forgets in-flight state).

## Scope dropdown

The selector above the textarea lets you pick which DB profiles `/ask`
queries:

- Multi-select checkboxes (one per saved profile)
- **All profiles** option (default for a new session)
- Per-session sticky — the selection persists until you change it
- **Focus** auto-detection — when ≥60 % of the last three turns
  mentioned the same profile, Studio shows a `Focus: <profile> (auto)`
  hint to indicate the system prompt is biased toward it. The biasing
  doesn't lock out cross-profile questions; it just shapes the default
  answer when the question is ambiguous.

A small `📄 N docs · 💻 M code` badge above the dropdown shows how many
doc / code profiles are in scope for the active DB selection — useful
when `/ask` answers seem under-grounded and you're not sure whether the
right RAG profiles are linked.

## Cache-only by default · Live refresh on demand

Every new session starts in **cache-only** mode. The agent answers
from the local catalog cache, the doc RAG index, and the code RAG
index without opening a live database connection — fast, free of
warehouse cost, and safe to run anywhere even when the production
DB isn't reachable.

When a question genuinely needs fresh data (recent inserts, a
schema change, row-level numbers), the agent does not silently dial
out. It returns a structured `needs_live_refresh` envelope and the
UI surfaces a one-click **"Enable Live refresh & retry"** affordance
under the assistant turn. Click it once to:

1. Flip the current session to allow live tool dispatches.
2. Replay the question with live retrieval enabled.

The toggle is per-session, so a different session in the same Ask
tab stays cache-only. The composer also exposes a **Live refresh**
switch you can flip preemptively if you know the next question
needs fresh data; this becomes the new default for that session
until you switch it back off.

## Chat bubbles

- **User turn** — left-aligned bubble, light background.
- **Assistant turn** — right-aligned, Markdown-rendered with GFM tables
  and code blocks.
- **Cancelled** — thin pill marker on the turn the user interrupted.

### Tool-call trace

Every assistant turn that called tools renders an expandable trace
under the bubble:

- Tool name + collapsed JSON arguments
- Tool-call latency in milliseconds
- Result preview (truncated to a few lines)
- Citations, when present, as a collapsible block

While the agent is still streaming, the trace doubles as a
**real-time activity feed** — each tool dispatch lights up the
moment it fires, the per-tool timer starts ticking immediately, and
a one-second LLM heartbeat shows up while the agent is between
tool calls. A long tool round no longer looks like a hang.

The tool surface is split into two tiers:

**Cache-only tools** (run on every question without hitting the
live DB):

| Tool | Purpose |
|---|---|
| `list_schemas` | Schema list for one or more profiles. |
| `list_tables_in_schema` | Tables in a given schema. |
| `describe_table` | Cached column list + comments for a table. |
| `describe_column` | One column's full cached metadata — type, comment, profiling stats. |
| `find_table_by_name` | Resolve a short name to a fully-qualified address. |
| `search_tables_by_concept` / `search_columns_by_concept` | Semantic search over the catalog embeddings. |
| `search_docs` / `search_code` | Hybrid RAG retrieval over linked doc and code profiles. |
| `get_join_candidates` / `find_joinable_tables` / `find_joinable_across_profiles` | Suggest joins from FKs, view DDL, query-log co-occurrence, and column-name overlap. |
| `lineage_for_table` / `lineage_for_column` | Cached lineage neighbours, both manual and AI-generated. |
| `catalog_coverage_summary` | Per-profile description coverage % across tables and columns. |
| `catalog_inventory` | Counts of profiles, schemas, tables, columns, lineage artifacts, ingested code assets. |
| `catalog_sync_status` | One-call freshness report across every profile — answers "are my tables fresh?" with zero DB queries. |
| `compare_runs` / `describe_run` | History-store reads for `/run` audit questions. |

**Live tools** (only available when Live refresh is on, surfaced
through the `needs_live_refresh` envelope when needed):

| Tool | Purpose |
|---|---|
| `list_volumes` | Live volume listing (Databricks Unity Catalog). |
| `run_count_query` / `run_sample_query` | Row-count or sample preview against the live DB. |
| `refresh_schema_cache` | Probe the live catalog and update AMX's cache row. |

### Asking about variations and mode

`describe_run` returns each result row with `alternatives_mode` at
the top level and a `variations[]` array of v2 / v3+ descendants
for that asset. Each variation entry carries its own `mode`
(`semantic` / `lexical`), the `seed_alternative_text` the user
picked, the `descendant_run_id`, and the variation's own
alternatives. The agent is taught the `semantic` vs `lexical`
contract: `semantic` means paraphrase of the seed (same factual
content, different surface form); `lexical` means re-use of the
seed's vocabulary with a distinct candidate meaning a reviewer
can tell apart. Example prompts:

- *"What variations did we try for `public.country.abbreviation`
  in run #99 — were they semantic or lexical?"*
- *"Evaluate the lexical variations on `sales.orders.status` in
  run #142 and name the distinct candidate meaning each version
  proposes."*
- *"Compare v1 and v2 of `users.email_status` in run #67 — what
  changed and what does the mode imply about the agent's
  reasoning?"*

For Re-Run descendants the `seed_alternative_text` is null (Re-Run
regenerates from scratch rather than anchoring on a seed); the
agent still surfaces `kind: "rerun"` and the descendant's mode so
you can reason about diversity decisions across versions. See
[Variations](variations.md) and
[Alternatives diversity mode](../concepts/alternatives-mode.md).

### Answer footer

Below each assistant turn:

`N profiles · X.Ys · focus: WAREHOUSE · 1 234 tokens · $0.0042`

Profile count, total latency, current focus, total token count, and the
per-turn cost. The cost is computed at the rates active when the turn
ran, not at current rates.

## Message input

- Textarea with markdown syntax highlighting
- Submit with Ctrl/Cmd-Enter (or the Send button)
- A **Cancel** button replaces Send while the agent is streaming —
  pressing it sets the cancel token; the answer stops at the next
  tool-call boundary

A `state.seedPrompt` hand-off from other pages (e.g. the
[Compare](compare.md) page's Ask AMX button) pre-fills the textarea and
auto-submits.

## Cross-references

| Studio | CLI |
|---|---|
| Ask chat | `/ask` |
| Sessions list | `/session list` |
| Resume session | `/session resume <id>` |
| End session | `/session end` |
| Scope dropdown | `/session scope [profiles]` and `/use-db <profile> [<profile>…]` |
| Tool-call trace | CLI prints tool names inline in the answer |
