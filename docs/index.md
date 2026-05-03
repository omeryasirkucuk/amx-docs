# AMX documentation

AMX (Agentic Metadata Extractor) is an open-source command-line tool that automates
database metadata discovery and documentation. It walks your database, reads your
documentation and codebase, then drafts a complete description for every table and column,
with confidence scores and a human-in-the-loop review before anything lands in the live
database.

AMX supports 10 database backends (PostgreSQL, Snowflake, Databricks, BigQuery, MySQL,
Oracle, SQL Server, Redshift, ClickHouse, DuckDB) and 7 LLM providers (OpenAI,
Anthropic, Gemini, DeepSeek, OpenRouter, Ollama, OpenAI-compatible local endpoints).

!!! tip
    AMX is interactive-first. The fastest way to evaluate it is `pip install "amx[postgresql]"`,
    then run `amx` and walk through the `/setup` wizard. The full happy path is in the
    [quickstart](getting-started/quickstart.md).

## Get started

<div class="grid cards" markdown>

-   **Install AMX**

    Install from PyPI with the database backends you need.

    [:octicons-arrow-right-24: Installation](getting-started/installation.md)

-   **Quickstart**

    Five-minute walkthrough — install, configure, run agents, review, apply.

    [:octicons-arrow-right-24: Quickstart](getting-started/quickstart.md)

-   **First-run walkthrough**

    Narrated end-to-end session against a sample SAP schema.

    [:octicons-arrow-right-24: First run](getting-started/first-run.md)

</div>

## Explore AMX

<div class="grid cards" markdown>

-   **Architecture**

    The CLI shell, multi-agent orchestrator, search agent, and storage layer.

    [:octicons-arrow-right-24: Architecture](concepts/architecture.md)

-   **Agents**

    What the Profile, RAG, and Code agents read and how the orchestrator merges them.

    [:octicons-arrow-right-24: Agents](concepts/agents.md)

-   **Universal Metadata Interface**

    The backend-neutral entity model that lets ten databases share one workflow.

    [:octicons-arrow-right-24: Universal metadata](concepts/universal-metadata.md)

-   **Human in the loop**

    The review wizard, bulk-accept, write-back, and audit trail.

    [:octicons-arrow-right-24: HITL review](concepts/human-in-the-loop.md)

</div>

## CLI reference

<div class="grid cards" markdown>

-   **Slash command map**

    Every namespace and command, grouped by purpose.

    [:octicons-arrow-right-24: CLI overview](cli/overview.md)

-   **`/run` and `/apply`**

    Run agents, review suggestions, write back to the database.

    [:octicons-arrow-right-24: Run and apply](cli/run-and-apply.md)

-   **`/ask` and `/search`**

    Conversational metadata Q&A with grounded retrieval.

    [:octicons-arrow-right-24: Ask and search](cli/ask-and-search.md)

-   **`/history`**

    Run history, comparison across runs, re-evaluation.

    [:octicons-arrow-right-24: History](cli/history.md)

-   **`amx doctor`**

    Diagnostics for install, config, and connectivity.

    [:octicons-arrow-right-24: Doctor](cli/doctor.md)

-   **Common flags**

    The shared flags (`--db-profile`, `--llm-profile`, `--apply`, `--csv`, …) used across commands.

    [:octicons-arrow-right-24: Flags](cli/flags.md)

</div>

## Backends

<div class="grid cards" markdown>

-   **All backends**

    Capability matrix and per-backend deep dives.

    [:octicons-arrow-right-24: Backends](backends/index.md)

-   **PostgreSQL**

    Reference adapter. Standard `COMMENT ON …` write-back.

    [:octicons-arrow-right-24: PostgreSQL](backends/postgresql.md)

-   **Snowflake**

    Account, warehouse, role; profile-mode tuning for cost.

    [:octicons-arrow-right-24: Snowflake](backends/snowflake.md)

-   **Databricks**

    Unity Catalog SQL warehouse, with TLS recovery for corporate networks.

    [:octicons-arrow-right-24: Databricks](backends/databricks.md)

-   **BigQuery**

    Project + dataset, byte-scanned cost guardrails.

    [:octicons-arrow-right-24: BigQuery](backends/bigquery.md)

-   **MySQL · Oracle · SQL Server · Redshift · ClickHouse · DuckDB**

    Six additional backends with first-class object-type listings.

    [:octicons-arrow-right-24: Backends index](backends/index.md)

</div>

## Operate AMX

<div class="grid cards" markdown>

-   **Configuration**

    `~/.amx/config.yml` schema, env vars, TLS and proxies, profiling modes.

    [:octicons-arrow-right-24: Configuration](configuration/config-yml.md)

-   **LLM providers**

    Setup and cost notes for each supported provider, including Batch mode.

    [:octicons-arrow-right-24: LLM providers](llm-providers/index.md)

-   **Data sources**

    Codebase scans, document RAG, and the search catalog.

    [:octicons-arrow-right-24: Data sources](data-sources/codebase.md)

-   **Collaboration**

    Shared history store, team setup, safety guards.

    [:octicons-arrow-right-24: Collaboration](collaboration/shared-history-store.md)

-   **Troubleshooting**

    FAQ, common errors, and using `amx doctor`.

    [:octicons-arrow-right-24: Troubleshooting](troubleshooting/faq.md)

-   **Python API**

    Stable `amx.core` surface for headless use from scripts and notebooks.

    [:octicons-arrow-right-24: Python API](api/index.md)

</div>

## Reference

<div class="grid cards" markdown>

-   **Changelog**

    Release notes for every published version.

    [:octicons-arrow-right-24: Changelog](changelog.md)

-   **Contributing**

    Development setup, branching, commit format, and the release process.

    [:octicons-arrow-right-24: Contributing](contributing.md)

-   **Security**

    How to report vulnerabilities. Supported versions and scope.

    [:octicons-arrow-right-24: Security](security.md)

</div>
