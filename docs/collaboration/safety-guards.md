# Safety guards

Shared mode adds three guards on top of plain dual-writing, and a fourth guard
protects the per-user `~/.amx/config.yml` itself from being corrupted by a
save that races with a concurrent edit. The guards exist because the shared
store is a multi-engineer surface — a confused session pointer or a typo'd
subcommand shouldn't be able to corrupt teammates' work — and because a
single bad config save can otherwise put the local AMX install in a state
that no command can recover from.

## Guard 1 — Cross-profile session resume is refused

`/session resume <id>` against a session that belongs to a different DB profile is
**refused with a clear error**.

The model:

- Each `/ask` session is bound to the DB profile that was active when it was created.
- Resuming the session against a different DB profile would let the conversation reference
  catalog state that doesn't exist in the new profile, leading to confidently wrong
  answers.

If you really need to look at a session from another profile, use `/session show --id N`
which is read-only.

## Guard 2 — Picker confirms destructive actions

The `/db` → `/history-store` picker confirms before doing anything destructive:

- **Disable** — confirms before turning off dual-writes.
- **Flush pending** — confirms before replaying the queued shared writes (because if the
  shared backend is permanently unreachable, you may want to drop the queue rather than
  retry).
- **Dump DDL** — confirms when running against a profile that already has the schema (to
  prevent accidentally re-bootstrapping).

The picker default is always **Status** — the safest, read-only action.

The corresponding direct subcommands (`amx db history-store disable`, `… flush-pending`,
`… dump-ddl`) skip the confirm — they're for scripts and intentional power-user use.

## Guard 3 — Every shared row carries attribution

Each row written to the shared store includes:

- `created_by` — username (`getpass.getuser()`).
- `hostname` — the machine that ran AMX (`socket.gethostname()`).
- `client_version` — the AMX version that wrote the row.
- `local_id` — the local SQLite INT id on the originating machine, for joining back.

This means:

- **Audit.** "Who ran this?" has an answer.
- **Provenance.** "What version of AMX wrote this?" has an answer — useful when bug fixes
  change description style.
- **Diff.** The dual-write coordinator can find the right shared row when later UPDATEs
  fire (e.g. when a run finishes and we update its terminal status).

## Guard 4 — Config save uses a shadow-fsync gate + 5-generation backup

Every `cfg.save()` walks the same multi-step path so that a crash or a
concurrent edit can never leave `~/.amx/config.yml` in a partially-written
state:

1. **Autosave suspend.** Background workers (scheduled runs, the dual-write
   outbox, doctor probes) are blocked from calling `save()` while the
   foreground REPL is mid-edit. Without this, two writers could race and
   the loser would clobber the winner's diff.
2. **5-generation rotation.** Before the live file is replaced, the current
   contents are copied to `config.yml.bak.1`. The previous backups are
   renumbered up to `.bak.5`; anything older is pruned.
3. **Shadow integrity gate.** New contents are written to
   `config.yml.shadow`, fsynced, and re-parsed through the YAML loader. The
   load must succeed and the resulting object must equal the in-memory
   model. Only then does `shadow → live` rename happen. A failed parse keeps
   the live file untouched and surfaces a warning into the REPL.
4. **[`/restore-config`](../cli/restore-config.md)** is the recovery handle
   if every gate above fails (extremely rare — typically an external
   process deleting the file mid-write). It lists the rotated backups and
   restores any of them, with the pre-restore state rotated to `.bak.1`
   so the operation is reversible.

This is the gate that PR #360 / #361 / #362 introduced after an
incident that briefly left a corrupt `history.db` save path stuck in
config.

## Why these four

Shared mode introduces three new failure modes, plus one local-machine
failure mode for config saves. Each guard maps to one:

| Failure | Guard |
|---|---|
| Engineer A's session memory bleeds into engineer B's catalog because of a typo'd `/session resume` | Cross-profile session resume refused |
| Engineer A runs `Disable` thinking it just turns off shared mode for one run; in fact it stops dual-writing for everyone using their workstation | Picker confirms destructive actions |
| Engineer A's runs and engineer B's runs are indistinguishable in the shared store | Every row carries attribution |
| A concurrent edit or a crash mid-`save()` leaves `~/.amx/config.yml` half-written, blocking every subsequent AMX command | Autosave suspend + 5-generation backup + shadow integrity gate + `/restore-config` |

## What is NOT guarded

These are intentional non-features:

- **No row-level access control in the shared store.** Anyone with read access to the
  shared backend's `AMX` schema can see every team member's runs. If you need
  per-engineer privacy, use separate schemas or separate backends.
- **No locking.** Two engineers can run AMX against the same table at the same time. Each
  produces their own run with their own results. The dual-write coordinator handles
  ordering.
- **No automatic conflict resolution at apply time.** If two engineers both `/apply`
  against the same column with different descriptions, the second write wins (by
  database-update semantics). Use the team workflow to coordinate big runs.

The trade-off: AMX optimises for low ceremony (no admin UI, no permission tables) at the
cost of trusting the team to coordinate via existing channels. For larger teams with
stricter compliance requirements, run AMX read-only (no `/apply`) and feed accepted
descriptions to your existing data-catalog tool through `--md` / `--json` exports.
