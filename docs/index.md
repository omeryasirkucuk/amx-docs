---
title: AMX — Agentic Metadata Extractor
description: AI-powered CLI that documents undocumented database schemas — pulls evidence from the database, your documentation, and your codebase, drafts column descriptions with confidence scores, then walks you through a human review before writing back.
---

![AMX components flow: Databases, Documents, and Codebase feed into AMX (Profile, RAG, and Code agents), which produces reviewed metadata accessible via Ask Metadata](assets/amx-flow.png){ .amx-flow-img }

<div class="amx-intro" markdown>

# AMX — Agentic Metadata Extractor

AMX (Agentic Metadata Extractor) provides AI-powered guidance and reference for data analysts, data engineers, and data catalog owners working with undocumented database schemas.

AMX walks your database, reads your documentation and codebase, then drafts a complete description for every table and column, with confidence scores and a human review before anything lands in the live database.

</div>

<div class="amx-why" markdown>

<div class="amx-why__pain" markdown>
**The pain**
Most AI metadata tools work **column-by-column, schema-only** — you approve generic suggestions one at a time, with no project context. Combining database + documentation + codebase evidence with a structured human review is rare; doing all four with native `COMMENT ON` write-back is rarer still.
</div>

<div class="amx-why__angle" markdown>
**The angle**
Database **+** documentation **+** codebase **+** human review, run together. Drafts in batches with confidence scores, written back as the SQL your warehouse already speaks. Whole-warehouse first-pass in **minutes**, not weeks.
</div>

<div class="amx-why__ask" markdown>
**Ask it**
Open a session with `/ask` and chat with the catalog you just built: *what joins to `customer`?*, *any columns missing descriptions?*, *what does `x_legacy_status` mean?*, *which tables haven't been touched in 90 days?*. Plain English in, grounded answers out — every response cites the exact catalog rows the LLM read, so you never get a fabricated column name back.
</div>

<div class="amx-why__compliance" markdown>
**Self-hosted**
AMX runs entirely in your environment. **No SaaS account, no data leaves your network**, bring-your-own-LLM — including local models (Ollama, vLLM, LM Studio). The compliance question collapses to *nothing leaves your perimeter*: schema names, sample values, generated descriptions, the audit trail — all stay where you started. Released under the **[Apache License 2.0](https://github.com/omeryasirkucuk/amx/blob/main/LICENSE)** — free for any use, including commercial.
</div>

</div>

![AMX interactive session: Agentic Metadata Extractor banner followed by version, config path, active database and LLM profile, and the root command palette (db / metadata / docs / llm / code / analyze / search / history)](assets/cli-hero.png){ .amx-hero-img }

!!! tip
    AMX supports 10 database backends and 7 LLM providers. The fastest way to evaluate
    is `pip install amx-cli`, then run `amx` and walk through the `/setup`
    wizard. Five minutes from install to your first reviewed description.

## Try AMX

<div class="grid cards" markdown>

-   [**Install AMX**](getting-started/installation.md)

    Install from PyPI with the database backends you need. Optional extras keep the default install lean.

-   [**5-minute quickstart**](getting-started/quickstart.md)

    Install, configure, run agents, review, apply. The full happy path in one short walkthrough.

-   [**First-run walkthrough**](getting-started/first-run.md)

    Narrated end-to-end session against a sample SAP schema. Useful before running against production data.

-   [**Run diagnostics**](cli/doctor.md)

    `/doctor` checks install, config, and connectivity from any shell — even when AMX itself can't start.

</div>

## Explore AMX

<div class="grid cards" markdown>

-   [**Architecture**](concepts/architecture.md)

    The CLI shell, multi-agent orchestrator, search agent, and storage layer.

-   [**The three agents**](concepts/agents.md)

    What the Profile, RAG, and Code agents read and how the orchestrator merges them.

-   [**Universal Metadata Interface**](concepts/universal-metadata.md)

    The backend-neutral entity model that lets ten databases share a single workflow.

-   [**Human-in-the-loop review**](concepts/human-in-the-loop.md)

    The review wizard, bulk-accept, write-back, and the full audit trail.

</div>

## CLI reference

<div class="grid cards" markdown>

-   [**Slash command map**](cli/overview.md)

    Every namespace and command, grouped by purpose.

-   [**`/run` and `/apply`**](cli/run-and-apply.md)

    Run agents, review suggestions, write back to the database.

-   [**`/ask` and `/search`**](cli/ask-and-search.md)

    Conversational metadata Q&A with grounded retrieval and live verification.

-   [**`/history`**](cli/history.md)

    Run history, comparison across runs, re-evaluation.

-   [**`/doctor`**](cli/doctor.md)

    Install / config / connectivity diagnostics.

-   [**Common flags**](cli/flags.md)

    `--db-profile`, `--llm-profile`, `--apply`, `--csv`, and the rest.

</div>

## Backends

<div class="grid cards" markdown>

-   [**All backends**](backends/index.md)

    Capability matrix and per-backend deep dives.

-   [**PostgreSQL**](backends/postgresql.md)

    Reference adapter. Standard `COMMENT ON …` write-back.

-   [**Snowflake**](backends/snowflake.md)

    Account, warehouse, role; profiling-mode tuning per workload.

-   [**Databricks**](backends/databricks.md)

    Unity Catalog SQL warehouse, with TLS recovery for corporate networks.

-   [**BigQuery**](backends/bigquery.md)

    Project + dataset, byte-scan controls for large tables.

-   [**MySQL · Oracle · SQL Server · Redshift · ClickHouse · DuckDB**](backends/index.md)

    Six additional backends with first-class object-type listings.

</div>

## Operate AMX

<div class="grid cards" markdown>

-   [**Configuration**](configuration/config-yml.md)

    `~/.amx/config.yml` schema, env vars, TLS and proxies, profiling modes.

-   [**LLM providers**](llm-providers/index.md)

    Setup notes for each supported provider, including Batch mode.

-   [**Data sources**](data-sources/codebase.md)

    Codebase scans, document RAG, and the search catalog.

-   [**Collaboration**](collaboration/shared-history-store.md)

    Shared history store, team setup, safety guards.

-   [**Troubleshooting**](troubleshooting/faq.md)

    FAQ, common errors, and diagnostic recipes.

-   [**Python API**](api/index.md)

    Stable `amx.core` surface for headless use from scripts and notebooks.

</div>

## Evaluation

<div class="grid cards" markdown>

-   [**Comparisons**](evaluation/comparisons.md)

    AMX vs Snowflake Cortex, Databricks AI Comments, BigQuery Gemini, Atlan, Collibra, DataHub, OpenMetadata — dimension by dimension, fairly.

-   [**Benchmarks**](evaluation/benchmarks.md)

    The state of the field, AMX's confidence-band scoring, and the public Databricks-style protocol AMX is preparing.

</div>

## Project

<div class="grid cards" markdown>

-   [**Changelog**](changelog.md)

    Release notes for every published version.

-   [**Contributing**](contributing.md)

    Development setup, branching, commit format, release process. Co-maintainers welcome.

-   [**Project team**](about.md)

    Maintained by Omer Yasir Kucuk · contributors and sponsors welcome via GitHub.

-   [**Security**](security.md)

    How to report vulnerabilities. Supported versions and scope.

-   [**GitHub repository**](https://github.com/omeryasirkucuk/amx)

    Source code, issue tracker, releases.

</div>
