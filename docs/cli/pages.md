# Pages

The `/pages` namespace turns AMX's catalog, code, and lineage knowledge
into shareable documentation pages. A page is markdown that AMX
composes with the LLM by gathering context from the assets you attach
(DB profiles, tables, columns, doc profiles, lineage artifacts, and
ingested remote code assets), then renders to Markdown or PDF for
distribution.

`/pages` is the persistent counterpart to a one-off `/ask` answer:
where Ask gives you a short response in the REPL, Pages stores the
result with a title, an intent record, attached assets, and a
revision history so it can be re-opened, edited, exported, and
assigned to a team scope.

## Prerequisites

- At least one DB profile (`/db add`) or one doc profile (`/docs add`).
- An active LLM profile that can generate text. Pages calls the same
  generation path as `/ask` and `/run`, so the rate that shows up in
  the sidebar is what each composition costs.
- Optional: an ingested remote-code surface — notebooks, jobs,
  pipelines, queries, streams, Streamlit apps — so the notebook /
  job / pipeline / query intent templates can resolve a specific
  asset. See [Remote code-asset ingestion](../data-sources/remote-code.md).

## Commands

### `/pages new`

Compose a new documentation page. The bare call runs a wizard;
flags promote it to a non-interactive shape for scripts and
power-users.

**Wizard form.** Bare `/pages new` walks you through:

1. **Title** — required.
2. **Intent template picker** — pick one of the presets below, or
   `Custom` to write a free-text intent yourself.
3. **Template-driven asset prompts** — the picker varies by
   template. A "single table" template prompts for the DB profile +
   schema + table; a "notebook walkthrough" template lists ingested
   notebooks for the profile you pick; a "cross-DB" template asks
   for a comma-separated list of profiles.
4. **Doc-profile attachment** *(offered for every template)* —
   attach doc profile(s) so the indexed corpus RAG-grounds the page.
5. **Source attachment** — attach local files (Markdown, PDF, xlsx,
   …) as **per-page** scratch input. AMX inlines them into the
   composition context for this page only. Multi-sheet xlsx files
   trigger a notice so you aren't surprised when every sheet is
   inlined as a separate table. If you attach any source files, AMX
   then offers to also index them into a permanent doc profile via
   the same path as `/docs add`.

**Intent templates** (use `--intent-template <slug>` to pre-pick):

| Slug | What it generates |
|---|---|
| `single-table` | Detailed summary of one table — purpose, columns, key relationships. |
| `single-column` | One column's origin, transforms, and downstream usage. |
| `db-profile-overview` | Whole-profile overview — schemas, table groups, key relationships. |
| `cross-db` | Cross-profile connections — joins and shared keys across DB profiles. |
| `lineage-narrative` | Pipeline / lineage walkthrough anchored on a lineage artifact. |
| `notebook-walkthrough` | Walkthrough of an ingested notebook. |
| `job-runbook` | Runbook for an ingested job — schedule, tasks, recent runs. |
| `pipeline-overview` | Pipeline overview — sources, transforms, target schema. |
| `query-playbook` | Explanation of an ingested SQL query. |
| `project-overview` | Multi-asset overview combining several profiles, docs, and lineage. |

**Power-user form.**

```text
/pages new \
  --title "Order processing pipeline" \
  --intent-template pipeline-overview \
  --asset db_profile:prod-pg \
  --asset doc_profile:eng-runbooks \
  --asset asset_pipeline:prod-pg:abc-123
```

`--asset` is repeatable; each value is `KIND:REF`. Valid kinds:

```
db_profile, db_database, db_schema, db_table, db_column,
doc_profile, lineage_artifact,
asset_notebook, asset_job, asset_pipeline,
asset_query, asset_stream, asset_streamlit
```

`--source <path>` is repeatable and attaches local files as per-page
input. `--intent "free text"` overrides any template. `--no-generate`
creates the draft row without calling the LLM — useful when you
want to write the body manually from `/pages edit`.

The output is a page id; the first ten lines of the generated body
print as a preview.

### `/pages list`

List active (non-deleted) pages with title, status, and last update
timestamp.

```text
> /pages list
┌─────────────────┬────────────────────────────────┬─────────┬─────────────────────┐
│ ID              │ Title                          │ Status  │ Updated             │
├─────────────────┼────────────────────────────────┼─────────┼─────────────────────┤
│ pg_4f2a1c8b     │ Orders pipeline runbook        │ ready   │ 2026-05-27T09:14:22 │
│ pg_9b1d4e7f     │ Customer 360 cross-DB joins    │ ready   │ 2026-05-26T18:02:51 │
│ pg_2c8e30aa     │ AI Generate quality notes      │ draft   │ 2026-05-25T11:42:08 │
└─────────────────┴────────────────────────────────┴─────────┴─────────────────────┘
```

### `/pages show <page_id>`

Print the page's current markdown body to stdout. Useful for
piping into another tool (`/pages show pg_… | bat`).

### `/pages edit <page_id> [--note "what changed"]`

Open the markdown body in `$EDITOR`, then save the result as a new
revision. Each save creates a row in `documentation_page_versions`
so you can roll back from Studio. An optional `--note` lands in the
revision entry for the audit trail.

### `/pages export <page_id> --format md|pdf [--out <path>]`

Render the current revision as Markdown or PDF. With `--out`, the
file is written to disk; without it, the payload streams to stdout
(binary for PDF, so pipe it: `/pages export pg_… --format pdf > out.pdf`).

PDF export uses the project's branded template so output is
distribution-ready.

### `/pages delete <page_id> [--purge]`

Soft-delete: marks the page as deleted but preserves history. The
page stops appearing in `/pages list` and Studio Browse → Pages
filters it out by default.

`--purge` hard-deletes the page row, its versions, its source
attachments, and its asset attachments — irreversible.

### `/pages assign-profile [slug] [--profile <name>]`

Associate a page with a DB profile so team members who scope by
profile see it on Studio Browse → Pages. Pass an empty `--profile`
to clear the field (the page becomes unscoped / cross-profile).

Bare call runs a wizard: pick the page, pick a profile from the
configured list, confirm. Power-user shortcut:

```text
/pages assign-profile orders-pipeline-runbook --profile prod-pg
```

## Storage

Pages live in the history store across four related tables:

- `documentation_pages` — the current head row (title, intent,
  status, `db_profile` scope, current markdown body).
- `documentation_page_versions` — every save from `/pages edit` or
  the Studio editor, ordered by revision number.
- `documentation_page_sources` — files attached to the page (the
  scratch-only sources from `/pages new --source`).
- `documentation_page_assets` — the catalog assets the page is
  grounded on (`KIND:REF` rows for every `--asset`).

If you have a [shared history store](../collaboration/team-setup.md)
configured, pages auto-backfill to the shared warehouse so other
members can find them on Studio Browse → Pages without an explicit
sync step.

## Cost tracking

Each composition records the LLM cost the same way `/run` does, so
the sidebar token-consuming rate stays accurate and the page-level
audit lets you see which compositions are the expensive ones over
time.

## Studio counterpart

The same surface is available in [AMX Studio](../studio/index.md)
under Browse → Pages — the wizard becomes a sidebar form, the
editor becomes a markdown editor with live preview, and exports
drop into your browser's downloads folder.

## See also

- [Remote code-asset ingestion](../data-sources/remote-code.md) — what
  populates the `asset_notebook` / `asset_job` / `asset_pipeline` /
  `asset_query` pickers.
- [Team setup](../collaboration/team-setup.md) — how pages flow to
  the shared warehouse for the rest of the team.
- [Run & apply](run-and-apply.md) — the analysis path that produces
  the descriptions a page references.
