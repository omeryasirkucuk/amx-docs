# Settings

`/settings` is the profile-management surface in Studio. It mirrors the
CLI's `/add-…-profile` wizards in a tabbed interface.

## Database {#database}

Lists every configured DB profile. Each row shows the profile name,
backend, host, and the database / catalog the profile pins.

Per-profile actions:

- **Edit** — re-open the wizard pre-filled with current values
- **Delete** — remove the profile (after confirmation)
- **Test connection** — round-trips a small probe and renders a green
  check or red error message in a modal

The **Add new profile** wizard is a multi-step dialog:

- Backend dropdown — PostgreSQL, MySQL, Snowflake, Databricks,
  BigQuery, Oracle, SQL Server, Redshift, ClickHouse, DuckDB
- Dynamic form fields per backend (host / port / username / password /
  database / catalog / schema / SSL settings / proxy / timeout / …)
- Inline help text per field
- **Test connection** before save

## LLM {#llm}

Lists every configured LLM profile with provider, model, and the live
per-1M-token price (auto-detected from the LiteLLM + OpenRouter pricing
cache, surfaced in [Pricing](pricing.md)).

The **Add new profile** wizard:

- Provider dropdown — OpenAI, Anthropic, Gemini, Databricks Serving,
  OpenRouter, DeepSeek, Ollama, local-via-LiteLLM, Kimi (see
  [LLM Providers](../llm-providers/index.md))
- Model dropdown — populated from the provider's offerings, or a
  free-text field
- API-key / base-URL fields appropriate for the provider
- **Alternatives per column** slider (1–5) — how many candidate
  descriptions the LLM emits per column.
- **Alternatives diversity mode** segmented control — choose whether
  those candidates are paraphrases (`semantic`) or
  shared-vocabulary candidate meanings (`lexical`). Disabled when
  alternatives per column is 1. See
  [Alternatives mode](../concepts/alternatives-mode.md) for the full
  reference and worked examples.
- **Confidence signal** dropdown — which per-alternative scorer
  drives the HIGH / MED / LOW pill on each row:
  `self_consistency` (default), `logprob`, `self_decl`, `judge`,
  `none`. See [Confidence signals](../concepts/confidence-signals.md)
  for what each one measures, score ranges, and how to tune the
  bands.
- Optional per-model price override — pre-filled with the auto-detected
  public rate, so an override is a deliberate tweak rather than a
  re-keying chore

## Docs {#docs}

Lists configured doc profiles. Each row shows the profile name, source
paths, and the DB profiles it's linked to.

The wizard exposes:

- Name field
- File path picker (filesystem or pasted)
- Linked DB profiles multi-select (optional — empty = global)

On save, AMX kicks off async indexing in the background. The status badge
on the row updates as the work progresses: Indexing → Ready → Failed.
Indexing status can also be inspected from
[System → Catalog](system.md#catalog).

## Code {#code}

Same shape as Docs, scoped to source-code paths. One path per profile
(filesystem or Git URL — cloned on first scan into
`~/.amx/code_cache/<slug>/`).

Linked DB profiles control which `/ask` scopes consult this code profile.

## Embeddings {#embeddings}

Docs RAG and code RAG carry independent embedding providers
(`cfg.embedding_docs` and `cfg.embedding_code`), so a code-specialised
encoder can drive code retrieval while a prose-tuned model drives the
documentation side. The tab renders two panels — one per side — sharing
the same form shape:

- **Provider** radio — MiniLM (Chroma bundled, offline default),
  OpenAI-compatible (OpenAI, OpenRouter, Together, Mistral, DeepInfra,
  Azure, vLLM / LM Studio / llama.cpp via `base_url`), or local
  sentence-transformers. The local option is auto-disabled with a hint
  when the host lacks the `sentence-transformers` extra.
- **Preset** dropdown (OpenAI-compatible only) — fills `base_url` with
  the matching endpoint.
- **Model**, **Base URL**, **API key** — rendered conditionally on the
  chosen kind. Keys are masked on read (`********`); leaving the
  placeholder in the save body preserves the existing secret.
- **Test connection** — embeds a one-token sentinel with the merged-
  but-not-yet-saved settings and reports a green pill with the vector
  dimension, or a red pill with the provider's error verbatim.
- **Save** — persists to `cfg.embedding_{docs,code}` and re-installs the
  process-wide embedding factory so subsequent `/search` and code-RAG
  queries pick up the new provider without restarting the server.

When the active provider drifts from what an existing collection was
embedded with, a yellow banner appears with the concrete collection
and chunk counts and a **Rebuild** button. The rebuild clears the
affected vector store so the next ingest or query re-embeds with the
active provider; document and code data themselves are untouched.

## MCP {#mcp}

The **MCP** tab connects AMX's catalog to IDE code agents (Cursor, Claude
Desktop, VS Code Copilot) over the Model Context Protocol, so the editor's
agent can read your schemas, descriptions, join keys, and lineage. See the
[Connect your IDE (MCP)](../guides/mcp.md) guide for the full walkthrough.

- **Status card per IDE** — a connection badge shows whether AMX is wired
  in, and whether a stored entry needs repair after AMX moved environments.
- **Connect** — pick an IDE and (optionally) a fixed profile scope, then
  write the IDE's config in one click; the per-IDE next steps (restart,
  agent mode) appear inline.
- **Config snippet** — a copyable block for clients you wire up by hand.
- **Exposed tools** — the read-only, cache-only catalog tools AMX surfaces;
  no live-database access and no credentials are involved.

## Profile linking

Both Docs and Code wizards expose a linked-DB-profiles multi-select.
This controls which `/ask` invocations see the profile's contents — a
doc profile linked to `prod-pg` is silent when `/ask` is running against
`dev-snowflake`, unless the link list is empty (= global).

## CLI equivalents

| Studio | CLI |
|---|---|
| DB tab | `/add-db-profile`, `/edit-db-profile`, `/remove-db-profile`, `/connect` |
| LLM tab | `/add-llm-profile`, `/use-llm`, `/temperature`, `/max-tokens`, `/n-alternatives`, `/cost` |
| Docs tab | `/add-doc-profile`, `/doc-link`, `/scan`, `/ingest` |
| Code tab | `/add-code-profile`, `/code-link`, `/code-scan` |
| Embeddings tab | `/embeddings docs`, `/embeddings code` |
| MCP tab | `/mcp connect`, `/mcp status`, `/mcp snippet`, `/mcp disconnect` |
