# AMX Studio

AMX Studio is the local web UI that mirrors the CLI in a browser. It runs on
`127.0.0.1`, opens automatically when you type `/studio`, and exposes the same
human-in-the-loop workflow the REPL drives — browse, run, review, apply,
audit — alongside Studio-only conveniences like the per-row pinned-cells
drawer, the live-cost progress card, and the keyboard command palette.

Studio is **not** a separate service. It boots in-process from `/studio`,
binds to the loopback interface only, and tears down when the REPL exits.
Two Studio tabs are isolated — opening a second browser tab on a different
DB profile never collides with the first.

## Launching

```text
> /studio
✓ AMX Studio booting on http://127.0.0.1:47821
✓ Opening browser…
```

Flags:

| Flag | Effect |
|---|---|
| `--port N` | Bind on port `N` instead of the default `47821`. Useful when 47821 is taken |
| `--no-open` | Don't auto-open the browser. AMX prints the URL and a one-shot bearer token to paste in |

Stop the server with `Ctrl-C` in the REPL. The next `/studio` invocation
generates a fresh bearer token, so older browser tabs lose access on restart.

## Security model

- **Loopback only.** Studio's HTTP server binds to `127.0.0.1` — not
  `0.0.0.0`. A coworker on the same network cannot reach it; only processes
  on this machine can.
- **One-shot bearer token.** Every `/studio` launch generates a fresh token,
  embeds it in the auto-opened URL (`?t=…`), and immediately strips it from
  the browser address bar. The token lives in `localStorage` from there.
- **No OpenAPI surface.** `/docs` and `/redoc` are not exposed; Studio's
  router is treated as an internal surface.
- **Secret masking.** Password / API-key / access-token fields are sent to
  the browser as `********`. PUTs that resend the masked placeholder are
  treated as "leave unchanged."

If you need to share Studio with a teammate, use SSH port-forwarding —
**never** rebind to `0.0.0.0`.

## What's where

| Page | URL | What it covers |
|---|---|---|
| [Overview](overview.md) | `/` and `/overview` | Landing card + dashboard with lifetime tokens, USD cost, success rate, recent runs |
| [Browse](browse.md) | `/db/:profile/…` or `/cat/:profile/…` | Database → schema → table → column with inline edits and per-asset Generate |
| [Runs](runs.md) | `/runs` | Filterable list of every `/run`, `/run-apply`, `/generate`, `/ask`, scheduled run |
| [Run detail](run-detail.md) | `/runs/:id` | Summary / Results / Scope / Settings tabs, live progress, ReRun, pinned cells |
| [Compare](compare.md) | `/runs/compare` | Pick 2–4 runs, side-by-side aggregate metrics, per-column grid, winner rings |
| [Ask](ask.md) | `/ask` | Multi-profile chat agent with sessions, scope dropdown, focus detection, tool-call trace |
| [Pending](pending.md) | `/pending` | Review queue with Preview-SQL modal, Apply confirmation, inline edits |
| [Audit](audit.md) | `/audit` | Day-grouped timeline of every applied change, identity / run / profile filters |
| [Settings](settings.md) | `/settings` | DB / LLM / Docs / Code profile wizards with test-connection and profile linking |
| [System](system.md) | `/system` | Doctor, token-usage windowing, catalog status, team-history toggle, maintenance |
| [Schedules](schedules.md) | `/runs/schedules` | Schedule lifecycle, scope tree, daemon install, review strategy |
| [Pricing](pricing.md) | `/pricing` | Searchable pricing table sourced from LiteLLM + OpenRouter, staleness banner |
| [DB cache](db-cache.md) | `/db-cache` | Per-profile cache stats and clear actions |
| [Keyboard](keyboard.md) | — | Command palette (`⌘K` / `Ctrl-K`) and other shortcuts |

## Responsive

Studio is responsive by default — every page is usable on a phone-sized
viewport. Layout breakpoints follow Tailwind's `sm:`, `md:`, and `lg:`
prefixes; DataTables hide non-critical columns on narrow screens via a
`hideOnMobile` flag; the sidebar collapses to an off-canvas drawer below
`md:`. See [Responsive Studio](../guides/responsive-studio.md) for the
pattern catalogue.

## CLI parity

Every workflow available in Studio also works from the REPL. The reverse
isn't quite true — a handful of CLI commands (e.g. `/restore-config`,
`/doctor`-style diagnostics) are surfaced only inside the System page or
not exposed at all. Where parity exists, the relevant Studio page links to
the equivalent CLI command(s).

## What's next

- Read the [Overview](overview.md) for the landing and dashboard layout.
- Or jump to [Browse](browse.md) to start exploring schemas and editing
  comments.
- For the CLI-side launcher entry point, see [`/studio`](../cli/studio.md).
