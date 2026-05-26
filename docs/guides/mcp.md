# Connect your IDE (MCP)

AMX already knows your data — schemas, descriptions, join keys, lineage,
and the docs and code you linked to it. The code agents in your IDE
(Cursor, Claude Desktop, VS Code Copilot) usually do not. AMX bridges
that gap with a **Model Context Protocol (MCP)** server: once connected,
your IDE's agent can read AMX's catalog and ground the data code it
writes in your real schema instead of guessing.

The connection is local, read-only, and set up once per machine.

## What it is

MCP is an open protocol that lets an application (here, your IDE) start a
small server and call its tools. AMX ships such a server. Your IDE
launches it on demand over standard input/output — there is no network
service to host, no port to open, and no separate login.

AMX exposes a **read-only, cache-only** slice of its catalog tools:

- Schema browsing — `list_schemas`, `list_tables_in_schema`,
  `describe_table`, `describe_column`.
- Concept search — `search_tables_by_concept`,
  `search_columns_by_concept`, `find_table_by_name`.
- Relationships — `get_join_candidates`, `find_joinable_tables`,
  `lineage_for_table`, `lineage_for_column`.
- Linked knowledge — `search_docs`, `search_code`, and catalog coverage
  summaries.

The server answers entirely from AMX's local catalog cache
(`~/.amx/history.db`). It never opens a live database connection and
needs no database credentials, so connecting an IDE cannot read or change
the data itself — only the metadata AMX has already collected.

!!! note "Supported IDEs"
    Cursor, Claude Desktop, and VS Code (GitHub Copilot agent mode). Any
    other MCP-capable client can use the printed config snippet.

## Connect from the CLI

Open the REPL and run `/mcp`. With no arguments it walks a short wizard:

```text
amx
[ ROOT ] /mcp
  Pick an operation:  Connect an IDE
  Pick an IDE:        Cursor
  Pick a profile scope: Active profiles (default)
  ✓ Connected AMX to Cursor (scope: active profiles).
    Config written to: ~/.cursor/mcp.json
    Next steps:
      • Fully quit and reopen Cursor so it picks up the new MCP server.
      • Open Cursor's chat in Agent mode and ask a data question.
```

`/mcp` lives under the `/llm` tab but is callable from any namespace —
typing it from another tab runs it and notes the canonical home. There is
**no `amx mcp …` shell-style invocation**; like every AMX method it is
typed inside the REPL.

The wizard's operations:

| Operation | What it does |
|---|---|
| Connect an IDE | Writes AMX's server entry into the IDE's MCP config |
| Show status | Lists each IDE and whether AMX is wired in |
| Show config snippet | Prints the block to paste manually |
| Disconnect an IDE | Removes only AMX's entry from the IDE config |

The first time you run `/mcp`, AMX installs the MCP SDK (a small,
pure-Python dependency) so the IDE-launched server starts cleanly.

### Profile scope

A connect exposes your **active** database profiles by default. Choose
*Pick specific profiles…* in the wizard to pin a fixed set instead — for
example, exposing only `sales` and `hr` to a given editor.

### Power-user shortcuts

The wizard is the recommended path; flags are an optional shortcut:

```text
/mcp connect cursor --profiles sales,hr
/mcp status
/mcp snippet vscode
/mcp disconnect cursor
```

## Connect from Studio

Open **Settings → MCP**. The tab mirrors the CLI:

- A status card per IDE with a connection badge.
- **Connect** — choose an IDE and (optionally) a profile scope, then
  write the config in one click; the per-IDE next steps appear inline.
- A copyable config snippet and a list of the exact tools AMX exposes.

## Set up once, not every time

After a connect, AMX has written a small entry into the IDE's own config
file (for Cursor, `~/.cursor/mcp.json`). That file is the durable record:
the IDE re-launches the AMX server every time it starts, so you do not
reconnect after closing the IDE, rebooting, or reopening AMX.

The entry pins the absolute path of the Python interpreter AMX runs under,
so it keeps working across restarts. If you later reinstall AMX into a
different environment, `/mcp status` flags the entry as needing repair and
a fresh `/mcp connect` rewrites it.

Because the status is read back from the IDE config on demand, reopening
AMX simply reports "connected" — there is nothing to redo.

## IDE notes

=== "Cursor"
    Config: `~/.cursor/mcp.json` (key `mcpServers`).

    After connecting, fully quit and reopen Cursor, then use its chat in
    **Agent mode**. AMX's tools are called automatically when the agent
    needs schema or lineage context.

=== "Claude Desktop"
    Config: the per-user `claude_desktop_config.json` (key `mcpServers`)
    under the platform's application-data directory.

    Restart Claude Desktop after connecting; AMX's tools appear under the
    tools (plug) icon in the message box.

=== "VS Code"
    Config: the user `mcp.json` (key `servers`, with `"type": "stdio"`).
    AMX writes the VS Code-specific shape for you, so you never hand-edit
    the JSON.

    Two extra steps are specific to VS Code: restart the editor, then
    switch **Copilot Chat to Agent mode** — MCP tools are only available
    there, not in Ask/Edit mode. A recent VS Code with GitHub Copilot is
    required; accept the workspace-trust prompt if VS Code shows one.

## Try it

With Cursor connected and restarted, ask its agent a data question:

> "I'm building a revenue-by-customer-segment report. Which tables do I
> join, and on what keys?"

The agent calls `search_tables_by_concept` to find the revenue and
customer tables, `get_join_candidates` to resolve the join key, and
`describe_column` to confirm types — then writes SQL grounded in your
actual catalog.

## Troubleshooting

| Symptom | Fix |
|---|---|
| IDE shows no AMX tools | Fully restart the IDE; MCP servers are discovered at launch. |
| VS Code: tools missing in chat | Switch Copilot Chat to **Agent mode**; MCP is unavailable in Ask/Edit mode. |
| `/mcp status` says "needs repair" | AMX moved environments — run `/mcp connect` again to rewrite the interpreter path. |
| Want to see what is exposed | Run `/mcp status`, or open **Settings → MCP** in Studio for the full tool list. |

## See also

- [CLI overview](../cli/overview.md) — the `/mcp` command under the `/llm` tab.
- [Studio settings](../studio/settings.md) — the MCP tab.
- [Catalog cache (architecture)](../concepts/catalog-cache.md) — the
  cache the MCP server reads from.
