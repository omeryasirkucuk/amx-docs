# `/analyze schedule` — scheduled runs reference

`/analyze schedule` is the subgroup that owns one-shot scheduled metadata runs:
the user picks a DB profile + LLM profile + scope + fire time, AMX persists the
schedule, and a small daemon (or a manual `tick`) fires it when due. The walkthrough
for picking a cadence and recovering missed fires lives in
[Scheduled runs](../guides/scheduled-runs.md); this page is the **subcommand
reference**.

Every subcommand is typed inside the AMX REPL, slash-form, exactly the way
[`/analyze run`](run-and-apply.md) and [`/analyze apply`](run-and-apply.md#4-apply-with-apply)
are. There is no top-level `amx <cmd>` invocation for this group — the namespace
is REPL-only by design, so tab completion and history pick up every subcommand.

## Prerequisites

- An AMX session (`amx`).
- At least one DB profile + one LLM profile (`/db-profiles`, `/llm`).
- For automatic firing: the AMX scheduler daemon installed
  (`/analyze schedule install-daemon`). Manual `tick` works without the daemon.

## Subcommand table

| Subcommand | Purpose |
|---|---|
| `/analyze schedule add` | Guided wizard. Picks DB profile, LLM profile, scope (all / schemas / tables / columns), and a fire time. Stores the row in `~/.amx/history.db`. |
| `/analyze schedule list` | Table listing. Status filters: `--status pending|fired|paused|failed`. Each row carries `id`, scope, next-fire timestamp, and last-fire result. |
| `/analyze schedule show <id>` | Full record: scope spec, profile pins, prompt detail, alternatives count, last `analyze.run` row id. |
| `/analyze schedule pause <id>` | Mark the schedule as paused. The next `tick` skips it without dropping the row. |
| `/analyze schedule resume <id>` | Inverse of `pause`. Re-arms the row at the originally scheduled time (no catch-up unless `--catch-up`). |
| `/analyze schedule rm <id>` | Delete the schedule. Past `analyze.run` rows it produced stay in `/history`. |
| `/analyze schedule run-now <id>` | Fire immediately, regardless of next-fire timestamp. Pass `--background` to detach from the REPL. |
| `/analyze schedule tick` | Engine command — one stateless pass over due rows. Honors `AMX_SKIP_BOOTSTRAP_TICK=1` when the REPL bootstraps so a fresh shell doesn't fire the queue twice. |
| `/analyze schedule status` | Engine command — daemon presence (systemd / launchd / Task Scheduler), missed-fire count, next-fire window. |
| `/analyze schedule install-daemon` | Install a per-user daemon. Detects the host OS: launchd plist on macOS, systemd `--user` unit on Linux, Scheduled Task on Windows. Idempotent — re-running upgrades the unit in place. |
| `/analyze schedule uninstall-daemon` | Remove the daemon unit. Existing schedules stay; the next `tick` is your responsibility. |

## Scope spec

`/analyze schedule add` writes a compact scope spec that the next `tick` replays
verbatim through the orchestrator. The spec mirrors `/analyze run` exactly:

| Spec | Meaning |
|---|---|
| `all` | Every schema reachable through the picked DB profile. |
| `schema:public,sales` | Only the listed schemas. |
| `table:public.users,sales.orders` | Only the listed tables (any schema-qualified pair). |
| `column:public.users.email,public.users.first_name` | Only the listed columns. |

The wizard offers the cascading picker (Profile → DB → Schema → Table → Column)
so you usually don't type the spec by hand — see [Multi-profile scoping](../concepts/scoping.md).

## Daemon vs manual tick

```text
> /analyze schedule install-daemon
✓ launchd plist installed at ~/Library/LaunchAgents/com.amxcli.scheduler.plist
✓ Daemon loaded. Next tick in <60s.

> /analyze schedule status
Daemon: loaded (launchd, last tick 14s ago)
Schedules: 4 active, 0 paused, 1 failed (id 7 — see /analyze schedule show 7)
Missed fires (closed AMX): 0
```

Without the daemon, every `tick` is your responsibility — either invoke
`/analyze schedule tick` manually inside the REPL or wire your own cron.
The engine is **stateless** between ticks: persistence lives in `~/.amx/history.db`,
the tick re-reads the queue on every call, so you can mix daemon and manual ticks
without double-firing (the row carries an advisory lock for the duration of its
run).

When AMX was closed at the scheduled time, the next REPL bootstrap surfaces the
missed fire — the bootstrap honors `AMX_SKIP_BOOTSTRAP_TICK=1` if you want a
shell that opens without firing the catch-up batch.

## Studio parity

Every command on this page has a 1:1 counterpart in
[AMX Studio → Schedules](../studio/schedules.md). The Studio surface
adds an edit dialog (`/runs/schedules`), one-click daemon install / uninstall
buttons, and a live status ticker.

## Verify

```text
> /analyze schedule list
ID  STATUS   NEXT FIRE              DB        SCOPE
1   pending  2026-05-14 03:00 UTC   prod-pg   schema:sales
2   pending  2026-05-14 03:00 UTC   prod-pg   table:public.users,public.orders
3   paused   —                      analytics column:public.events.payload

> /analyze schedule status
Daemon: loaded · 4 active · next fire in 8h 12m
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Daemon: not installed` even after install-daemon | Re-run from a TTY (launchd / systemd refuse to load when stdin isn't a terminal); check the OS-native log (`launchctl print user/<uid>/com.amxcli.scheduler`). |
| Schedule fires twice on the same minute | Two daemons installed (e.g. via cron *and* `install-daemon`). Run `/analyze schedule uninstall-daemon` and rely on one. |
| `next fire in -3h` (past timestamp) | The host clock drifted or the schedule sat through a long AMX-closed window — `/analyze schedule run-now <id>` to fire once, then resume. |
| Spec rejected with "unknown column" | The DB schema drifted since the schedule was added. `/analyze schedule show <id>` to inspect, `rm` + re-`add` to rebuild. |

## What's next

- [Scheduled runs walkthrough](../guides/scheduled-runs.md) — the workflow this reference backs.
- [Multi-profile scoping](../concepts/scoping.md) — what the cascading picker writes into the scope spec.
- [Studio Schedules tab](../studio/schedules.md) — the same operations in a web UI.
