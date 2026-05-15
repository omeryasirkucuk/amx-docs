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

- **macOS** — `launchd` plist under `~/Library/LaunchAgents/`
- **Linux** — `systemd --user` unit
- **Windows** — Task Scheduler entry

Once installed, the status badge shows the next fire window. **Uninstall
daemon** removes the OS hook (existing schedules remain queued; they
just won't fire until the daemon is back).

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

- **Name**
- **Fire at (local)** — datetime picker; must be in the future
- **Timezone** — auto-detected from the browser; can be overridden
- **DB profile** dropdown
- **Database / catalog** — cascades from the profile, auto-picks when
  there's only one
- **Scope tree** — ScopeTree component, cascading
  profile → database → schema → table → column. Selection is
  additive: ticking deeper narrows the scope; unticking widens back to
  "everything below"
- **LLM profile** dropdown
- **Review strategy** — Auto / Manual radio

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
