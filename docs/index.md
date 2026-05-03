---
title: AMX documentation
---

<div class="amx-pageintro">
  <div class="amx-breadcrumb">
    <a href="./">Home</a>
    <span class="amx-breadcrumb__sep">›</span>
    <span>Documentation</span>
  </div>
  <div class="amx-pagemeta">Last updated on May 3, 2026</div>
</div>

# AMX documentation

AMX (Agentic Metadata Extractor) provides AI-powered guidance and reference for data
analysts, data engineers, and data catalog owners working with undocumented database
schemas. AMX walks your database, reads your documentation and codebase, then drafts a
complete description for every table and column, with confidence scores and a human
review before anything lands in the live database.

!!! tip
    AMX supports 10 database backends and 7 LLM providers. The fastest way to evaluate
    is `pip install "amx[postgresql]"`, then run `amx` and walk through the `/setup`
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

    `amx doctor` checks install, config, and connectivity from any shell — even when AMX itself can't start.

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

-   [**`amx doctor`**](cli/doctor.md)

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

    Account, warehouse, role; profile-mode tuning for cost.

-   [**Databricks**](backends/databricks.md)

    Unity Catalog SQL warehouse, with TLS recovery for corporate networks.

-   [**BigQuery**](backends/bigquery.md)

    Project + dataset, byte-scanned cost guardrails.

-   [**MySQL · Oracle · SQL Server · Redshift · ClickHouse · DuckDB**](backends/index.md)

    Six additional backends with first-class object-type listings.

</div>

## Operate AMX

<div class="grid cards" markdown>

-   [**Configuration**](configuration/config-yml.md)

    `~/.amx/config.yml` schema, env vars, TLS and proxies, profiling modes.

-   [**LLM providers**](llm-providers/index.md)

    Setup and cost notes for each supported provider, including Batch mode.

-   [**Data sources**](data-sources/codebase.md)

    Codebase scans, document RAG, and the search catalog.

-   [**Collaboration**](collaboration/shared-history-store.md)

    Shared history store, team setup, safety guards.

-   [**Troubleshooting**](troubleshooting/faq.md)

    FAQ, common errors, and diagnostic recipes.

-   [**Python API**](api/index.md)

    Stable `amx.core` surface for headless use from scripts and notebooks.

</div>

## Quick links

<div class="grid cards" markdown>

-   [**Changelog**](changelog.md)

    Release notes for every published version.

-   [**Contributing**](contributing.md)

    Development setup, branching, commit format, release process.

-   [**Security**](security.md)

    How to report vulnerabilities. Supported versions and scope.

-   [**GitHub repository**](https://github.com/omeryasirkucuk/amx)

    Source code, issue tracker, releases.

</div>
