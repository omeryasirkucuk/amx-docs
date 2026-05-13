# `/restore-config` — recover from a bad config save

`/restore-config` is the recovery handle for the rare case where a save
corrupts `~/.amx/config.yml` (or its `AMX_CONFIG_DIR` override). It lists the
rotated backups AMX writes on every successful save, lets you pick one
interactively, and restores it. The pre-restore state itself becomes the new
`config.yml.bak.1`, so the operation is always reversible.

This page covers the command's three usage forms and how the rotation pairs
with the autosave-suspend + shadow-integrity gate that keeps the file from
going corrupt in the first place — see [Safety guards](../collaboration/safety-guards.md)
for the broader picture.

## Prerequisites

- AMX installed.
- A previous AMX session has run at least one save (so backups exist).

## Backup rotation — what AMX writes for you

Every successful `cfg.save()` writes the current file to a numbered backup
**before** replacing it. AMX keeps five generations:

```text
~/.amx/
├── config.yml          ← live file
├── config.yml.bak.1    ← most recent prior state
├── config.yml.bak.2
├── config.yml.bak.3
├── config.yml.bak.4
└── config.yml.bak.5    ← oldest kept
```

Older generations are pruned on each save. The save path is also guarded by a
**shadow integrity gate**: AMX writes to `config.yml.shadow`, fsyncs, re-parses
to confirm the file round-trips through the YAML loader, and only then renames
shadow → live. A failed parse keeps the live file untouched and surfaces a
warning instead of silently shipping a broken config.

## Usage

### Interactive picker (default)

```text
> /restore-config
Available backups (5 of max 5):
  config.yml.bak.1 (2026-05-13 14:22:11, 3.4 KB)
  config.yml.bak.2 (2026-05-13 13:08:54, 3.3 KB)
  config.yml.bak.3 (2026-05-13 11:51:02, 3.3 KB)
  config.yml.bak.4 (2026-05-13 09:17:39, 3.2 KB)
  config.yml.bak.5 (2026-05-12 18:44:08, 3.2 KB)

Restore which backup?
  [1] config.yml.bak.1 (2026-05-13 14:22:11, 3.4 KB)
  [2] config.yml.bak.2 (2026-05-13 13:08:54, 3.3 KB)
  ...
> 1
✓ Restored ~/.amx/config.yml from config.yml.bak.1
  (the pre-restore state was rotated to config.yml.bak.1 so this is reversible)
```

### Just list — no restore

```text
> /restore-config --list
Available backups (5 of max 5):
  config.yml.bak.1 (2026-05-13 14:22:11, 3.4 KB)
  ...
```

Use the alias `-l` if you prefer.

### Restore an explicit file

```text
> /restore-config --from /tmp/known-good-config.yml
✓ Restored ~/.amx/config.yml from /tmp/known-good-config.yml
```

Use this when the backup you want isn't in the rotation (e.g. a file you
copied out of a previous machine). The aliases `-f` and `--from` both work.

## Verify

```text
> /config show
# Inspect the values you expected from the restored backup.
> /doctor
# Confirm profiles, LLM, and DB connectivity all come back green.
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No rotated config backups found` | The rotation only starts after the first `save()` that follows the introduction of this safety net. Run any command that mutates config (`/add-db-profile`, `/use-llm`, `/temperature 0.3`) to seed the first backup. |
| `Backup file not found: …` after `--from` | Path typo or expansion error. The path is `Path(...).expanduser()`-resolved; `~/Downloads/cfg.yml` works, but a shell variable that wasn't substituted (`$HOME/...`) won't. |
| Restore succeeds, but `/doctor` still reports a missing profile | The selected backup pre-dates the profile. Pick an older / different generation or use `--from` to point at a known-good file. |
| `config.yml.shadow` left on disk | Means the last save aborted between shadow-fsync and rename. Safe to delete; the live file is intact. The same gate also writes a warning into the REPL on the next bootstrap. |

## What's next

- [Safety guards](../collaboration/safety-guards.md) — autosave-suspend, 5-generation rotation, shadow integrity gate, and what each prevents.
- [`/config`](overview.md#the-full-namespace-tree) — show / edit individual fields instead of rolling the whole file back.
