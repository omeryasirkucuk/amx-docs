# Settings

`/settings` is the profile-management surface in Studio. It mirrors the
CLI's `/add-…-profile` wizards in a four-tab tabbed interface.

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

## What's next

- [System](system.md) — where indexing status, doctor, token usage live.
- [Pricing](pricing.md) — the LLM pricing surface the LLM tab reads
  from.
