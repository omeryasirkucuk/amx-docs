# Overview

Studio has two top-level entry surfaces — the **Landing** (`/`) and the
**Overview dashboard** (`/overview`). The landing keeps the workspace calm
and oriented; the dashboard surfaces the numbers a maintainer wants at a
glance.

## Landing (`/`)

The landing page is what you see immediately after `/studio` opens the
browser. It is intentionally low-density:

- **Status pills** — active LLM profile, configured DB profile count, and
  any pending review queue. Each pill links to the page that resolves it,
  and renders a warning chip when the underlying state is missing
  (no LLM configured, zero DB profiles, etc.).
- **Action grid** — four cards: **Browse**, **New run**, **Ask**, **Audit**.
  Each card greys out with a reason text when its preconditions aren't
  met (e.g. "No DB profile configured" on Browse and New run).
- **Recent activity** — a five-row excerpt of the most recent runs across
  every command (run, run-apply, generate, ask, schedule), each row
  navigable to its [Run detail](run-detail.md) page.
- **Footer link** to the [Overview dashboard](#overview-dashboard) for
  token + cost detail.

The landing replaces a previous behaviour where `/` redirected to the
dashboard immediately; the dashboard is still one click away, but a fresh
session starts in a quieter place.

## Overview dashboard (`/overview`) {#overview-dashboard}

The dashboard is denser — it answers "how much have I used AMX, and is it
working?"

Six stat cards (3-column grid on `md:` and up, stacks on mobile):

| Card | What it shows |
|---|---|
| **LLM model** | Active model name. Click → [Settings → LLM](settings.md#llm) |
| **Total runs** | All-time count across every command kind. Click → [Runs list](runs.md) |
| **Success rate** | Percentage of runs that finished cleanly. Click → [Runs list](runs.md) |
| **Input tokens** | All-time input tokens summed across every recorded run |
| **Output tokens** | All-time output tokens summed across every recorded run |
| **Total cost (USD)** | All-time USD spend (frozen at run time, never re-priced) |

Cost-card click-throughs land on the [System → Token usage](system.md#token-usage)
section where the same totals can be windowed (Today / 24 h / 7 d / 30 d /
All time) and broken out by `(provider, model)`.

Below the stat cards, a **Recent runs** card lists the eight most recent
runs with an activity icon, run ID, command, scope summary, DB profile,
model, duration, relative timestamp, and a status pill. Every row is
clickable to the corresponding [Run detail](run-detail.md) page.

## Empty states

A fresh install lands on a landing with three placeholder cards:

- "Configure a DB profile" → [Settings → Database](settings.md#database)
- "Configure an LLM profile" → [Settings → LLM](settings.md#llm)
- "Start your first run" (greyed out until both of the above complete)

The dashboard mirrors this — every stat card shows `—` until at least one
run has landed, and the **Recent runs** card renders an icon + "No runs
yet" line.
