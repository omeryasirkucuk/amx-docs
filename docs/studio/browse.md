# Browse

The **Browse** surface is how you navigate the database hierarchy in
Studio — profile → database (or catalog) → schema → table → column. Every
level supports inline-edit on the description text, a per-asset
**Generate** action that drafts a comment through the same human-in-the-loop
queue the CLI uses, and a scope-aware **Generate description** dialog for
bulk runs.

## Routes

Studio supports two URL shapes, one per backend hierarchy:

| Shape | When | Routes |
|---|---|---|
| **2-level** (`/db/…`) | PostgreSQL, MySQL, Snowflake, Oracle, SQL Server, Redshift, ClickHouse, DuckDB | `/db/:profile/:database`, `/db/:profile/:database/:schema`, `/db/:profile/:database/:schema/:table` |
| **3-level** (`/cat/…`) | Databricks (Unity Catalog), BigQuery | `/cat/:profile/:catalog/:schema`, `/cat/:profile/:catalog/:schema/:table` |

Encoding the profile and the catalog/database into the URL means two
browser tabs on different profiles never share scope. Bookmarks survive
profile renames as long as the URL is regenerated.

## Sidebar tree

The left sidebar lists every saved DB profile as its own expandable row.

- A profile collapses to show just its name; expanding it lazy-loads the
  database/catalog tier from the live connection.
- Each level (profile, database/catalog, schema) gets a **Refresh** (🔄)
  button that re-syncs from the backend. A small spinner replaces the
  icon while the refresh is in flight.
- A search box at the top filters by substring across profile names,
  databases, schemas, and tables — useful in workspaces with many
  profiles.
- A pinned-catalog or pinned-database badge marks a profile whose config
  restricts the visible scope (set via `/use-db` or the profile editor).

The **DB cache** entry near the bottom links to the [DB cache](db-cache.md)
inspection page.

## Database page (`/db/:profile/:database`, `/cat/:profile/:catalog`)

Header: database / catalog name, breadcrumbs, an inline-edit description
box, and a **Generate description** button.

The **Schemas** card below lists every schema reachable in the database
with a folder icon, schema name, current comment (line-clamped to one
line), and a per-row **Gen** button that drafts the schema comment in the
background.

## Schema page

Same layout, one level deeper. The card lists every table, view, and
materialised view — each prefixed by an asset-kind icon coloured by kind
(accent for `TABLE`, positive for `VIEW`, warning for
`MATERIALIZED_VIEW`). The row is clickable to the table page.

## Table page

The header is the same edit + generate pair, applied to the table-level
comment. The body is a **Columns** card rendered as a responsive
DataTable:

| Column | Notes |
|---|---|
| Column name | Mono font, left-pinned on desktop |
| Data type | |
| Current comment | Click to inline-edit |
| Status | Icon: commented vs uncommented |
| Actions | Per-row **Gen** button |

The summary line above the table reads `N columns total, M commented`.
The DataTable supports sort, filter, and search; non-critical columns
hide on mobile via the `hideOnMobile` flag (see
[Responsive Studio](../guides/responsive-studio.md)).

## Generate description dialog

Triggered from the header **Generate description** button on any Browse
page. Two options:

- **Just this database / schema / table.** Single LLM call, inline. The
  result lands directly in the description box.
- **Everything (bulk run).** Spawns a full background `/run` over the
  asset's children — equivalent to running `/run <scope>` from the CLI.
  Progress lands in [Runs](runs.md); results route to
  [Pending](pending.md).

Optional doc / code profile chips below the two options let you pick the
RAG context the agent should consult. Empty = use the linked profiles
configured for the active DB scope.

## CLI equivalents

| Studio | CLI |
|---|---|
| Inline-edit description | `/edit <db>.<schema>.<table>.<column>` |
| Per-asset **Gen** | `/generate <db>.<schema>.<table>.<column>` |
| Generate description (bulk) | `/run <scope>` |
| Refresh sidebar tier | `/sync --db-profile <name>` |

## What's next

- [Pending](pending.md) — review and apply draft comments.
- [Run detail](run-detail.md) — what a bulk run produces.
