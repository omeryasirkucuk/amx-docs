# Schedules

`/runs/schedules` manages LLM-driven metadata analysis schedules and the
background daemon that fires them.

!!! note "Cache refresh schedules are on a different page"
    Scheduled cache refreshes (`kind='cache_refresh'`) are managed from
    [Catalog cache](db-cache.md#scheduled-refreshes), not here. This page
    covers `kind='analyze'` runs only — the LLM-annotated metadata passes.

## Daemon status

The top of the page shows whether the schedule daemon is installed.
**Install daemon** sets up the per-OS scheduler:

- **macOS** — `launchd` plist under `~/Library/LaunchAgents/`. On
  modern macOS (Big Sur and later), AMX uses the
  `launchctl bootstrap` / `enable` / `kickstart` sequence rather
  than the deprecated `launchctl load`, so the daemon actually
  ends up loaded instead of installed-but-dormant.
- **Linux** — `systemd --user` unit
- **Windows** — Task Scheduler entry

The status badge has two states that look similar but are not:

- **Installed** — the plist / unit file exists on disk but
  `launchctl` (or the platform equivalent) does not know about it.
  Schedules will not fire.
- **Loaded** — the plist / unit is registered with the OS scheduler.
  Schedules fire at their next tick.

The badge also surfaces `log_size_bytes` and `log_mtime` from the
daemon log file so you can tell at a glance whether the daemon has
been writing recently — a stale `log_mtime` with a small
`log_size_bytes` usually means the daemon was installed but never
loaded; reinstall to repair.

**Uninstall daemon** removes the OS hook (existing schedules
remain queued; they just won't fire until the daemon is back).

## Schedule list

The body is a DataTable of every queued schedule.

| Column | Notes |
|---|---|
| Name | Human-readable label |
| Fire time | Next execution, local datetime + timezone |
| Scope | Summary, e.g. `public.users, public.orders` |
| Status | Pending / Paused / Running / Completed / Failed / Missed / Cancelled |
| LLM profile | The model the run will use |
| Review strategy | Auto (apply immediately) / Manual (queue for review) |
| Actions | Edit, Pause/Resume, Run now, Delete |

Filter chips above the table: Pending / Paused / Failed.

## New / edit schedule dialog

The same dialog covers both create and edit.

- **Trigger** — Cron-based (default) or **Change-triggered**.
  Cron-based schedules fire at the picked datetime + cadence.
  Change-triggered schedules fire when the catalog cache detects a
  schema change on the selected scope — useful for "re-analyse only
  when the upstream table actually moves" workflows. Pick the
  trigger first; the rest of the form adapts.
- **Name**
- **Fire at (local)** *(cron triggers)* — datetime picker; must be
  in the future. Change-triggered schedules show a cadence cap
  here instead ("run at most every N hours") to debounce noisy
  catalogs.
- **Timezone** — auto-detected from the browser; can be overridden
- **DB profile** dropdown
- **Database / catalog** — cascades from the profile, auto-picks when
  there's only one
- **Scope tree** — ScopeTree component, cascading
  profile → database → schema → table → column. Selection is
  additive: ticking deeper narrows the scope; unticking widens back to
  "everything below"
- **LLM profile** dropdown
- **Review strategy** — Auto (apply immediately) / Manual (queue
  for review)

Server-side validation rejects past fire-at times.

## Tick model

The daemon is stateless per fire — it re-reads the queue every tick and
picks the next due schedule. A missed schedule (machine asleep at fire
time) is detected on the next AMX startup and surfaced via the **Missed**
status; you can decide whether to **Run now** or skip.

## CLI equivalents

| Studio | CLI |
|---|---|
| Install daemon | `/schedule install-daemon` |
| Uninstall daemon | `/schedule uninstall-daemon` |
| New schedule | `/schedule add` |
| Schedule list | `/schedule list` |
| Show details | `/schedule show <id>` |
| Pause / Resume | `/schedule pause <id>`, `/schedule resume <id>` |
| Run now | `/schedule run-now <id>` |
| Delete | `/schedule rm <id>` |
| Daemon status | `/schedule status` |
