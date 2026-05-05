# `/visualize` — local AMX web UI

`/visualize` boots the AMX web UI on `127.0.0.1:<port>`, generates a one-shot
bearer token, and opens your default browser at the token-protected URL. It's the
same review-and-apply workflow you get in the REPL — runs, results, the pending
queue, the `/ask` chat, and full DB / LLM / Docs / Code profile management — but
on a denser surface where you can see everything at once.

![AMX visualizer Overview page — sidebar with active SAP profile and schemas, four stat cards (active backend, LLM model, total runs, success rate), and a Recent runs feed with four `Schema description` rows](../assets/visualize-overview.png)

## Prerequisites

- AMX installed (`pip install amx-cli`). The visualizer ships **inside** the
  `amx-cli` wheel — there is no separate package to install and no Node toolchain
  required.
- A modern browser (Chrome, Firefox, Safari, or Edge).
- An active DB and LLM profile, or a clean install ready for the in-browser
  `/setup` wizard.

## Quick start

```bash
amx /visualize
```

Or as a top-level shell command:

```bash
amx visualize
```

The default port is **47821**. Pass `--port <n>` to pin a specific port, or
`--no-open` to skip the auto-launch when running over SSH.

```bash
amx /visualize --port 8080
amx /visualize --no-open
```

The launcher prints the token-protected URL — copy it into a browser on the same
machine if `--no-open` was used, or use a tunneling tool to reach it from a
laptop while the server runs on a remote box.

## What's in the UI

| Page | What it does | Backed by |
|---|---|---|
| **Overview** `/` | Stat cards (active backend, LLM model, total runs, success rate) + Recent runs feed. Tile and row click-throughs jump to Settings or the run detail. | `/api/history/stats`, `/api/history/runs` |
| **Browse** `/db/:profile`, `/db/:profile/:schema`, `/db/:profile/:schema/:table` | Walk the live database. Inline-edit any database / schema / table / column comment, or hit **Generate** to have the LLM draft just that asset and write it back through the same review loop the CLI uses. | `/api/live/...`, `/api/comments/...`, `/api/generate/...` |
| **Runs** `/runs` | Every `/run` and `/run-apply` invocation, filterable by status (Succeeded / Failed / Running / Cancelled) and sortable by Started. Compare 2–4 runs side-by-side via the **Compare** button. | `/api/history/runs`, `/api/history/compare` |
| **Run detail** `/runs/:id` | Live SSE progress while a run streams (sticky banner with elapsed timer + current activity + N/total processed), then a tabbed Summary / Results / Scope / Settings view once the run finishes. Per-row alternatives carousel + skip + custom-edit + restore. | `/api/history/runs/{id}`, `/api/pending/...` |
| **Ask** `/ask` | Streaming chat with the AMX search agent — reasoning + tool calls + grounded answer, with a sessions sidebar and end-session control. | `/api/ask` (SSE), `/api/ask/sessions/...` |
| **Settings** `/settings` | Tabbed profile management for DB / LLM / Docs / Code — list, activate, edit, delete, plus the full per-backend wizards (PostgreSQL, Snowflake, Databricks, BigQuery, MySQL, Oracle, SQL Server, Redshift, ClickHouse, DuckDB) and per-provider LLM wizards. Same fields as `/add-db-profile` / `/add-llm-profile` / `/add-doc-profile` / `/add-code-profile`. | `/api/profiles/...` |
| **System** `/system` | Doctor checks (re-run, skip-network toggle), per-(provider, model) token usage + cost over today / 24h / 7d / 30d / all, search-catalog status, team history-store enable / disable, and one-click placeholder cleanup. | `/api/doctor`, `/api/usage`, `/api/catalog/status`, `/api/admin/...` |

The top bar also surfaces the active **DB profile**, **catalog / database**, and
**LLM profile** as click-to-switch dropdown pills, plus a `⌘K` / `Ctrl-K` command
palette for jumping to any page or quick action.

## Generate descriptions from any page

Bulk runs (the canonical `/run` path) stay the right tool when you want to fill
in many assets at once. The Browse pages add a one-asset-at-a-time path for the
times you want to fix or draft a single comment without spinning up a full run:

- **Database page** → "Generate description" button writes the database / catalog
  comment directly.
- **Schema page** → "Just this schema" (single LLM call) vs "All tables" (full
  bulk run, redirects to the live run-detail stream).
- **Table page** → "Just this table" vs "All columns".
- **Column rows** → per-row "Gen" button writes that one column's `COMMENT` in
  place.

Every generated suggestion still goes through the human-in-the-loop review queue
— nothing lands in the live database until you accept it.

## Cancelling long-running jobs

`/run` and `/apply` jobs run in daemon threads inside the parent CLI process.
Each carries a `threading.Event` cancel token plumbed through the orchestrator;
clicking **Cancel** on the progress card sets the token and the loop bails
between rows.

`/apply` cancellation **commits whatever was already written** — matching the
CLI's <kbd>Ctrl-C</kbd> behaviour. The transaction boundary is per-row, so
partial work is never rolled back to spare you a multi-minute redo.

In-flight LLM HTTP calls cannot be killed mid-flight (provider SDKs don't expose
cancellation), so cancellation latency is "one tool/agent step" — typically a
few seconds.

## Security model

The visualizer binds **only** to `127.0.0.1` — never `0.0.0.0`. On top of
loopback isolation, every API call carries a one-shot bearer token generated
fresh per `/visualize` invocation. The SPA captures the token from `?t=…` on
first load, stashes it in `localStorage`, and strips it from the URL bar so it
doesn't end up in browser history.

EventSource clients (the SSE streams behind `/ask`, `/run`, and `/apply`)
re-attach the token via `?t=…` because browsers don't allow custom headers on
`EventSource`.

You can rotate the token by stopping the server (<kbd>Ctrl-C</kbd>) and
re-running `amx /visualize`.

### What's not exposed

- The JSON API does not include `/docs` or `/redoc`. The OpenAPI surface stays
  internal so the visualizer doesn't accidentally expose your AMX configuration
  to anyone who happened to grab the token.
- Static asset routes (`/`, `/assets/*`) are unauthenticated by design — they
  only ship the SPA bundle, not data.
- Secret fields (`password`, `access_token`, `api_key`) are masked as `********`
  in every response. PUT bodies treat the placeholder as "leave the existing
  value alone" so editing one field on a profile doesn't blank the secret.

## Troubleshooting

### Browser opens to a 404 / "Connection refused"

The server may have failed to bind (port `47821` busy and the ephemeral fallback
also fell over). Pass `--port` to force a different port:

```bash
amx /visualize --port 8765
```

### "Visualizer auth is not configured" on every request

The token cookie / `localStorage` entry was wiped or never captured on this
browser. Re-launch `amx /visualize` and let the launcher re-open the browser
with a fresh `?t=…` URL.

### `/ask` returns "Search catalog isn't initialised yet"

Run `/sync` (or `/run` once) to populate the SQLite-backed catalog. The
visualizer reuses the same store the CLI's `/ask` uses, so a sync from either
side surfaces immediately.

### Pending queue is empty but I just approved rows

The visualizer reads `~/.amx/pending_metadata.json`. If you're on shared-mode
history, the queue is still local-only by design (write-back is per-machine).

### Connection-test on a Databricks profile fails with a TLS error

The visualizer reuses `DatabaseConnector.test_connection_result()`, so the same
TLS setup as the CLI applies. Set `tls_no_verify=true` (or pin a
`tls_trusted_ca_file`) on the profile from Settings, then click **Test** again.

## What's next

- [`/run` and `/apply`](run-and-apply.md) — same workflow, REPL-flavoured.
- [`/ask` and `/search`](ask-and-search.md) — the conversational surface that
  the visualizer's Ask tab wraps.
- [Human-in-the-loop review](../concepts/human-in-the-loop.md) — what the
  Pending queue actually does and why every Generate goes through it.
