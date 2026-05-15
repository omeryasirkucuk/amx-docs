# Metadata

The `/metadata` namespace is the universal editing surface for descriptions that
already exist (or that you want to author by hand). It is engine-agnostic — the
same commands work whether the underlying backend is PostgreSQL, BigQuery,
Databricks, Snowflake, or any other supported adapter.

Use this surface when you want to:

- inspect what AMX currently knows about a schema, table, or column,
- check coverage across a schema before running `/analyze`, or
- hand-write a description without going through the full agent pipeline.

`/manual` is an alias for `/metadata`.

## Prerequisites

- An active DB profile (`/use-db <name>` or scope via `--db-profile`).
- For `/edit` writes to land on the database, the connection user needs comment
  privileges on the target object.

## Commands

### `/inspect [schema] [table]`

Inspect the current metadata state for an asset.

```text
> /inspect sales orders
Schema: sales
Table:  orders                       (12 columns, table-level comment present)
Columns:
  order_id        bigint    PK       "Surrogate key for the order line"
  customer_id     bigint             "FK → customers.customer_id"
  placed_at       timestamp          (no comment)
  ...
```

If `schema` and `table` are omitted, AMX inspects whatever is pinned by
`/use-db` + `current_schema` + `current_table`. With only `schema`, every table
in that schema is listed with a coverage summary.

### `/monitor [schema]`

Show metadata coverage across the active scope.

```text
> /monitor sales
Schema: sales
  orders         12/12 columns commented  (100 %)
  order_items     8/14 columns commented  ( 57 %)
  customers       9/9  columns commented  (100 %)
  ...
Total: 78 / 102 commented (76 %)
```

Useful as a "where do we stand?" check before scheduling a top-up run or
deciding whether the documentation effort is mature enough to apply.

### `/edit [db][.schema[.table[.column]]]`

Two ways to invoke:

**Path form.** The fully-qualified asset address goes straight to the editor:

```text
> /edit warehouse.sales.orders.order_id
Editing column comment: warehouse.sales.orders.order_id
Current: "Surrogate key for the order line"
New:     ▮
```

The path can be partial — `/edit warehouse.sales.orders` opens the table-level
editor, `/edit warehouse.sales` opens the schema-level editor.

**Wizard form.** Bare `/edit` walks you through a picker:

```text
> /edit
[1/4] Pick a database / catalog: ...
[2/4] Pick a schema:              ...
[3/4] Pick a table:               ...
[4/4] Pick a column (or skip to edit the table comment): ...
```

Writes are staged into the same pending queue `/run` populates, so a hand-edit
goes through the same human-in-the-loop apply path. Confirm with `/apply` (or
the Studio Pending page).

## Verify

```text
> /inspect sales orders
> /monitor sales
> /edit sales.orders                # opens the table-level editor
```

After saving an edit, the next `/inspect` shows the new text immediately (it
lives in the pending queue) and the underlying database is updated once you run
`/apply`.
