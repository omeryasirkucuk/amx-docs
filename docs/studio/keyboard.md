# Keyboard

Studio exposes a small set of keyboard shortcuts. The most useful is the
**command palette** — a single popup that jumps to any page or runs a
quick action without leaving the keyboard.

## Command palette (`⌘K` / `Ctrl-K`)

Press `⌘K` on macOS (`Ctrl-K` on Linux / Windows) anywhere in Studio.
The palette opens, focuses its search input, and lists:

- **Pages** — every Studio route, fuzzy-matched against the input
- **Quick actions** — `New run`, `New schedule`, `Refresh prices`,
  `Open System → Doctor`, `Apply pending queue`, …
- **Recent runs** — the last few run IDs, jumpable directly

Type to narrow; arrow-keys to navigate; Enter to fire. `Esc` closes the
palette without doing anything.

## Inline-edit shortcuts

Anywhere a description is inline-editable (Browse, Run detail Results
tab, Pending queue):

- `Enter` (or click outside) — save the edit
- `Esc` — discard and restore the prior value
- `Shift + Enter` — newline inside the edit field (multi-line edits)

## Run detail

- `[` / `]` — previous / next row in the Results tab
- `p` — pin / unpin the current row
- `s` — skip the current row
- `a` — accept the current row
- `r` — open the ReRun dialog for the current row (or selected rows)

## Ask

- `Ctrl/Cmd-Enter` — submit the current message
- `Esc` (while streaming) — cancel the in-flight answer
- `Ctrl/Cmd-Up` / `Ctrl/Cmd-Down` — cycle through the prior questions in
  this session

## What's next

- [Run detail](run-detail.md) — where most of the keyboard surface lives.
- [Ask](ask.md) — the chat-specific shortcuts.
