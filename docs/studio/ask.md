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

## Chat bubbles

- **User turn** — left-aligned bubble, light background.
- **Assistant turn** — right-aligned, Markdown-rendered with GFM tables
  and code blocks.
- **Cancelled** — thin pill marker on the turn the user interrupted.

### Tool-call trace

Every assistant turn that called tools (`search_docs`, `search_catalog`,
`list_schemas`, `list_volumes`, `find_joinable_across_profiles`,
`compare_runs`, …) renders an expandable trace under the bubble:

- Tool name + collapsed JSON arguments
- Tool-call latency in milliseconds
- Result preview (truncated to a few lines)
- Citations, when present, as a collapsible block

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

## What's next

- [Multi-profile scoping](../concepts/scoping.md) — how scope encoding
  works across CLI and Studio.
- [Search catalog](../data-sources/search-catalog.md) — the index `/ask`
  reads from.
