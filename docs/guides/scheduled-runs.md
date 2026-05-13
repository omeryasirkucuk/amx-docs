# Scheduled runs

AMX can hold a one-shot metadata run for you and fire it at a specific
future moment in the timezone you choose. This is useful for running
heavy discovery off-hours, coordinating a refresh with downstream
consumers, or simply not having to remember.

This guide covers what scheduled runs are, how they fire when AMX is
closed, how to set up the always-on daemon, and how to ask the Ask
agent about your upcoming plans.

## Quick orientation

Schedules live under the **analyze** tab in both surfaces:

* **CLI REPL:** open `amx`, then every command is typed at the
  `[ ROOT ]` prompt as `/analyze schedule <verb>`. Examples below.
* **Studio:** Open the **Runs** page, click **Schedules** in the
  page actions. The dedicated screen at `/runs/schedules` mirrors
  the CLI.

There is **no `amx schedule …` shell-style invocation** — every
method lives under a tab and is invoked from inside the REPL.

## Mental model

A scheduled run is a small record that carries:

| Field            | Meaning |
|------------------|---------|
| `name`           | Human-readable label, e.g. `Quarterly meta refresh`. |
| `fire_at_utc`    | Canonical fire time in UTC. |
| `fire_at_tz`     | The IANA timezone you picked. Used for display + DST. |
| `db_profile`     | Which database profile the run targets. |
| `scope_json`     | High-level scope (`schemas`, `tables`, or `all`). Resolved live against the DB at fire time, so new tables under a scheduled schema are picked up automatically; missing entities surface as a clean failure with `last_error` populated. |
| `llm_profile`    | Which LLM profile to use. |
| `review_strategy`| `auto` or `manual`. |

Schedules are **one-shot**: they fire once and then sit as a historical
record. There is no recurring-cron grammar — metadata discovery is a
plan, not a rhythm.

## The catch-up contract

AMX is an invocation-based developer tool. It is not always running.
When you create a schedule, AMX shows:

```
Heads-up: AMX is invocation-based — it isn't always running.
For this schedule to fire on time, EITHER keep AMX/Studio open at
that moment, OR enable the background daemon now:

    /analyze schedule install-daemon

Without the daemon, if AMX is closed at fire time, this schedule will
be surfaced as 'missed' the next time you open AMX, and you can run
it then.
```

This is the explicit contract:

* **Daemon installed** → schedules fire exactly on time, even while
  AMX is closed.
* **Daemon not installed** → the next time you open AMX (CLI or
  Studio) the bootstrap pass surfaces missed schedules in a banner
  pointing you at `/analyze schedule list`. Nothing is silently lost.

The same pass also recovers any in-flight runs that were interrupted
(process killed, machine slept, network dropped). They get marked
`failed` with reason "Recovered stale running run (heartbeat threshold
exceeded)" so you see the gap in your run history.

## Creating a schedule

### From the CLI REPL

```text
$ amx
[ ROOT ]  db  metadata  docs  llm  code  analyze  search  history

> /analyze schedule add
Schedule name: Quarterly refresh
Fire time (local, YYYY-MM-DD HH:MM): 2026-12-31 09:00
Timezone (IANA) [Europe/Istanbul]:

Available DB profile:
  [1] prod_sf  (current)
  [2] staging
Pick a DB profile (number or name) [prod_sf]: 1

Available LLM profile:
  [1] claude
  [2] gpt-5.5
Pick a LLM profile (number or name) [claude]: 1

Scope mode (all, schemas, tables) [all]: schemas

Available schemas (comma-separated indices or names):
  [1] public
  [2] staging
Pick schemas: 1,2

Review strategy (auto, manual) [auto]:
Schedule #7 created…
```

Every flag is optional — supply them on one line for a non-interactive
create:

```
> /analyze schedule add \
    --name "End of quarter refresh" \
    --at "2026-12-31 09:00" \
    --tz "Europe/Istanbul" \
    --db prod_sf \
    --scope "schema:public,staging" \
    --llm claude \
    --strategy auto
```

`--scope` accepts:

| Form                   | Meaning |
|------------------------|---------|
| `schema:a,b`           | One run covering every table under schemas `a` and `b`. |
| `table:s.t1,s.t2`      | One run covering specific `schema.table` pairs. |
| `all`                  | Everything visible to the active profile. |

### From Studio

Open **Runs → Schedules**. The **New schedule** dialog mirrors the
CLI wizard with picker-driven inputs:

* **DB profile** dropdown — pre-populated from your saved profiles.
* **LLM profile** dropdown — same.
* **Scope mode** dropdown:
    * `All schemas in this DB` — no further input needed.
    * `Specific schemas` — checkbox list pulled live from the chosen DB.
    * `Specific tables` — pick a schema on the left, tick tables on the
      right; repeat for each schema you want to include.
* **Fire time** datetime picker + IANA timezone field (defaults to
  your browser timezone).
* Review strategy dropdown (`auto` / `manual`).

The same heads-up message appears below the form.

## Managing schedules

In the CLI REPL:

| Command                                       | Effect |
|-----------------------------------------------|--------|
| `/analyze schedule list`                      | Active entries (pending / paused / missed / running). |
| `/analyze schedule list --past`               | Completed / failed / cancelled history. |
| `/analyze schedule list --all`                | Everything. |
| `/analyze schedule show <id>`                 | Full JSON detail for one schedule. |
| `/analyze schedule pause <id>`                | Pause a pending schedule. |
| `/analyze schedule resume <id>`               | Re-enable a paused schedule. |
| `/analyze schedule rm <id> [-y]`              | Hard delete + audit event. |
| `/analyze schedule run-now <id>`              | Fire immediately (regardless of `fire_at_utc`). |

Studio's Schedules page exposes the same actions as inline buttons
on each row.

## The daemon

The opt-in background daemon is the only way to fire schedules while
AMX is closed.

### macOS

```text
> /analyze schedule install-daemon
```

Writes a `launchd` plist (one per `AMX_CONFIG_DIR`, so prod and dev
coexist), loads it via `launchctl`, and points its stdout/stderr at
`$AMX_CONFIG_DIR/logs/scheduler.log`. Every minute the daemon runs
`/analyze schedule tick --silent`, which fires any schedule whose
`fire_at_utc` has elapsed.

To check it:

```text
> /analyze schedule status
```

To remove it:

```text
> /analyze schedule uninstall-daemon
```

### Linux

The Linux path installs a per-user systemd `.service` + `.timer`
under `~/.config/systemd/user/`. Same minute cadence; same
status / uninstall commands.

### Windows

Windows is not currently supported for the daemon. Scheduled runs
still work whenever AMX or Studio is open (catch-up). For always-on
scheduling, use AMX on macOS or Linux.

### Multiple AMX installs on one machine

The daemon's launchd label / systemd unit name is derived from
`AMX_CONFIG_DIR`. Prod (`~/.amx`) registers as `com.amx.scheduler`;
a dev install (`AMX_CONFIG_DIR=~/.amx-dev`) registers as
`com.amx-dev.scheduler`. They don't collide, so you can run both.

## Missed and interrupted runs

When you open AMX (or Studio) after a closure, the bootstrap pass
prints one line:

```
⚠️ 1 interrupted run recovered (marked failed); 2 schedules missed
while AMX was closed. Run `/analyze schedule list` to review.
```

From there:

* `/analyze schedule list` shows missed entries with status `missed`.
* `/analyze schedule run-now <id>` fires one immediately.
* `/analyze schedule rm <id>` discards it.

In Studio the same banner appears at the top of the Schedules page,
and missed entries are tagged with the orange `Missed` chip.

## Asking the agent

The Ask agent has two read-only tools backed by the same data:

| Tool                 | Use it when |
|----------------------|-------------|
| `list_schedules`     | "What scheduled runs do I have coming up?" / "Did I miss anything yesterday?" |
| `get_schedule(id)`   | "Tell me everything about schedule #7." / "Did last week's run for prod succeed?" |

Both are read-only. The agent never creates, edits, pauses, or
deletes schedules — those actions stay on the Schedules page and the
`/analyze schedule` REPL commands.

## Troubleshooting

**The schedule fired but the run is empty.**
The initial Orchestrator integration is a no-op stub that creates
the `analysis_runs` row, links it to the schedule, and immediately
completes. The full per-table run is wired into a later release; until
then the schedule's lifecycle exists end-to-end but no metadata is
written.

**The schedule fires too late.**
Without the daemon, AMX has to be open at fire time. With the daemon,
the cadence is ~60 seconds — a schedule's fire may be observed up to
one tick interval late on average.

**The schedule failed with `Schema 'public' not found`.**
The scope is resolved against the live DB at fire time, not at
creation time. If the schema or table was renamed / dropped between
create and fire, the schedule fails fast and `last_error` names the
missing entity. Edit the schedule (only allowed while pending or
paused) and re-arm.

**Two AMX installs are stepping on each other.**
Each install reads `AMX_CONFIG_DIR`. Use `amx` for prod
(`~/.amx`) and `amx-dev` for dev (`~/.amx-dev`). The daemon label
derives from this so the OS keeps them separate.
