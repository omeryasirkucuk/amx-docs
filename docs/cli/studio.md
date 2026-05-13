# `/studio` — local AMX web UI (AMX Studio)

`/studio` boots **AMX Studio** on `127.0.0.1:<port>`, generates a one-shot
bearer token, and opens your default browser at the token-protected URL.

```text
> /studio
✓ AMX Studio booting on http://127.0.0.1:47821
✓ Opening browser…
```

Flags:

| Flag | Effect |
|---|---|
| `--port N` | Bind on port `N` instead of `47821` |
| `--no-open` | Don't auto-open the browser. AMX prints the URL and token to paste in |

Both `/studio` (REPL slash command) and `amx studio` (Click subcommand
from a shell) call the same `amx.web.launch_studio` entry point.

![AMX Studio Overview page](../assets/studio-overview.png)

## Where to read more

The full Studio reference lives in its own section:

- [Studio overview](../studio/index.md) — security model, responsive
  patterns, launch flags
- [Browse, Runs, Run detail, Compare, Ask, Pending, Audit, Settings,
  System, Schedules, Pricing, DB cache, Keyboard](../studio/index.md#whats-where)
  — per-page walkthroughs

## What's next

- [Studio index](../studio/index.md) — every Studio page in one map.
- [Responsive Studio](../guides/responsive-studio.md) — the mobile
  pattern catalogue.
