# AMX in VS Code (extension)

AMX ships a full management surface for VS Code-family editors: browse
the catalog, launch and watch runs, chat with Ask, inspect lineage, and
manage profiles and schedules — without leaving the editor. On top of
that, the extension wires AMX's catalog into the editing experience
itself: hover a table name in a `.sql` file and the description AMX
generated appears inline.

The extension is **not on the Marketplace**. It ships *inside* the
`amx-cli` wheel and is installed from AMX itself — either the `/vscode`
command in the REPL or the **Settings → VS Code** tab in Studio. That
distribution model keeps the extension and the server in **version
lockstep**: the extension version always equals the `amx-cli` version
that bundled it, so the editor surface can never drift ahead of (or
behind) the API it talks to. There is no separate release channel to
track and no compatibility matrix to consult.

!!! note "Requirements"
    `amx-cli >= 0.19` and one of the supported editors below. The
    extension talks to a local AMX server on `127.0.0.1` with a
    per-session bearer token; nothing leaves your machine.

## Supported editors

| Editor | Detected via |
|---|---|
| VS Code | `code` CLI on PATH + standard install locations |
| VS Code Insiders | `code-insiders` CLI + standard install locations |
| Cursor | `cursor` CLI + standard install locations |
| Windsurf | `windsurf` CLI + standard install locations |
| VSCodium | `codium` CLI + standard install locations |

Detection covers PATH and the standard per-platform install locations
on macOS, Windows, and Linux.

## Install from the CLI

Open the REPL and run `/vscode`. With no arguments it walks a short
wizard: it detects the editors installed on the machine and installs
the bundled extension through each editor's own CLI.

```text
amx
[ ROOT ] /vscode
  Detected editors:
    • VS Code        — extension not installed
    • Cursor         — extension not installed
  Pick an editor:  VS Code
  ✓ Installed AMX extension 0.19.0 into VS Code.
    Reload the editor window to activate it.
```

There is **no `amx vscode …` shell-style invocation**; like every AMX
method it is typed inside the REPL.

The subcommands:

| Command | What it does |
|---|---|
| `/vscode install [editor]` | Install (or update) the bundled extension into one editor, or pick from the wizard |
| `/vscode status` | Per-editor table: installed version vs. bundled version, with an out-of-date flag |
| `/vscode uninstall [editor]` | Remove the AMX extension from an editor |

If no editor CLI can be found — common when VS Code was installed
without adding `code` to PATH — the wizard prints the path of the
bundled `.vsix` file plus the manual steps: open the editor's
Extensions view, choose **Install from VSIX…**, and pick that file.

## Install from Studio

Open **Settings → VS Code**. The tab mirrors the CLI:

- A card per detected editor showing the installed extension version
  next to the bundled one, with an **update available** badge when they
  differ.
- **Install** / **Reinstall** / **Uninstall** buttons per editor.
- A **Download .vsix** link for manual installs on machines where no
  editor CLI is reachable.

## A tour of the extension

### Activity Bar views

The AMX icon in the Activity Bar opens four tree views:

- **Profiles** — your DB, LLM, Docs, and Code profiles, with add /
  edit / delete / test / activate on the right-click menu. The add and
  edit dialogs are **schema-driven wizards**: the forms are generated
  from the server's backend field specs, so a new backend's fields
  appear without an extension update.
- **Catalog** — profile → database (or Unity Catalog) → schema →
  table → column. Right-click any node for **Sync Catalog**, **Deep
  Sync**, **Analyze This Schema**, **Start Run Here**, **Edit /
  Generate Description**, and **Copy Qualified Name**.
- **History** — recent runs with friendly labels (scope + relative
  time). Right-click **Re-run** a finished row or **Cancel** a running
  one; the title bar carries a **Start Run** button.
- **Schedules** — create, edit, delete, pause, resume, and run-now for
  scheduled runs.

### Studio panels in the editor

The heavier surfaces open as webview panels rendering the Studio SPA
against the local server: **Ask** chat, run launch with **live SSE
progress**, the **Run detail** page, the **Lineage canvas**, **Pages**,
and **Settings**. It is the same Studio you get from `/studio`, framed
inside the editor next to your code.

### SQL editor intelligence

In `.sql` files the extension recognizes table and column references
**across every configured profile** and lights them up:

- **Hover** — the catalog description for the table or column under
  the cursor.
- **Completion** — table and column names from the catalog.
- **CodeLens** — open the asset in Studio, or generate a description
  for an undescribed one.
- **Diagnostics** (off by default) — optional documentation-coverage
  squiggles flagging referenced assets that still lack descriptions.

### Selection lookup in any file

Table references don't live only in `.sql` files. Select any text —
for example a table name inside a Python `spark.sql("""…""")` string —
and use the lightbulb or right-click **AMX: Search Selection in
Catalog**. The lookup is **granularity-aware**: a bare database or
schema name surfaces that container first rather than a flat list of
column hits, and each match opens the corresponding Studio page.

## How the extension finds AMX

On activation the extension locates an existing AMX install (a Python
interpreter with `amx-cli`, or the `amx` binary) and connects to it. If
none is found, it offers to install `amx-cli` into a managed
environment. If a Studio server is already running from your REPL
session, the extension **adopts** it; otherwise it starts its own
headless server on `127.0.0.1`, authenticated with a per-session bearer
token.

## Updating

The extension updates with AMX, not on its own. After upgrading:

```text
pip install -U amx-cli
amx
[ ROOT ] /vscode install
```

— or click **Reinstall** on the editor's card in **Settings →
VS Code**. `/vscode status` shows which editors are running an
older bundled version than the AMX you just installed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/vscode` finds no editors | The editor's CLI is not on PATH and no standard install location matched. Use the printed `.vsix` path with **Extensions → Install from VSIX…** in the editor. |
| Extension reports it is older than the server | You upgraded `amx-cli` but not the bundled copy in the editor — run `/vscode install` again (or **Reinstall** in Studio). |
| `/vscode status` shows an out-of-date flag | Same as above: reinstall to bring the editor's copy up to the bundled version. |
| Extension cannot find AMX | Accept its offer to install `amx-cli` into a managed environment, or open a terminal where `amx` resolves and reload the editor window. |

## See also

- [CLI overview](../cli/overview.md) — the `/vscode` command in the namespace tree.
- [Studio settings](../studio/settings.md) — the VS Code tab.
- [Connect your IDE (MCP)](mcp.md) — the complementary surface that
  exposes AMX's catalog to the *agents* inside your IDE; the extension
  is the management UI, MCP is the agent-tooling bridge.
