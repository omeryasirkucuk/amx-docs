---
hide:
  - navigation
  - toc
---

# AMX

**Stop staring at `T0001.AUDAT NUMBER(8)` wondering what it means.**

AMX is the **Agentic Metadata Extractor** — a CLI that walks your database, reads your
documentation and codebase, then emits a complete description for every table and column,
with confidence scores and a human-in-the-loop review before anything lands in the live DB.

[Install AMX :material-rocket-launch:](getting-started/installation.md){ .md-button .md-button--primary }
[5-minute quick start :material-clock-fast:](getting-started/quickstart.md){ .md-button }
[View on GitHub :material-github:](https://github.com/omeryasirkucuk/amx){ .md-button }

---

## What it produces

Cryptic identifier in:

```text
sap_s6p.t001.audat   NUMBER(8) NULL
```

Reviewed description out (after one `/run`):

```text
sap_s6p.t001.audat — Document date. The calendar date the source business event
was recorded, distinct from posting date (BUDAT) which controls the accounting
period the transaction lands in.

  confidence: high · logprob: 0.91 · sources: code (3 refs), docs, db profile
```

The same multi-agent pipeline runs against tables, views, materialized views, and
schema-level descriptions.

---

## Why AMX

<div class="grid cards" markdown>

-   :material-database-search:{ .lg .middle } **Backend-agnostic**

    ---

    Ten supported databases — PostgreSQL, Snowflake, Databricks, BigQuery, MySQL, Oracle,
    SQL Server, Redshift, ClickHouse, DuckDB. Each adapter exposes the object types its
    backend treats as first-class.

    [:octicons-arrow-right-24: See backends](backends/index.md)

-   :material-robot:{ .lg .middle } **Multi-agent inference**

    ---

    Three independent sub-agents — Profile (DB stats), RAG (documents), Code (codebase) —
    merged by an orchestrator. Each suggestion carries provenance and a confidence score.

    [:octicons-arrow-right-24: How agents work](concepts/agents.md)

-   :material-account-check:{ .lg .middle } **Human in the loop**

    ---

    Nothing is written to your database without your review. Accept the top suggestion,
    pick from alternatives, write your own, or skip.

    [:octicons-arrow-right-24: HITL review](concepts/human-in-the-loop.md)

-   :material-shield-lock:{ .lg .middle } **Cost guardrails**

    ---

    `full` / `sampled` / `metadata` profiling modes keep warehouse cost bounded.
    Logprob-driven confidence calibration. Budget-aware batch sizes.

    [:octicons-arrow-right-24: Profiling modes](configuration/profiling-modes.md)

-   :material-account-group:{ .lg .middle } **Team collaboration**

    ---

    Optional shared history store dual-writes runs to a backend the team already owns —
    so two engineers running AMX against the same warehouse can see each other's analyses.

    [:octicons-arrow-right-24: Shared history store](collaboration/shared-history-store.md)

-   :material-language-python:{ .lg .middle } **Library-first API**

    ---

    Use AMX from Python without the CLI. `amx.init()` and `infer_table_metadata()` are
    part of the stable public surface, semver-tracked from 1.0.

    [:octicons-arrow-right-24: Python API](api/index.md)

</div>

---

## Quick start

```bash
pip install amx                  # installs core + all LLM SDKs
amx                              # opens the interactive session
/setup                           # walks you through DB + LLM profiles
/run                             # picks scope, runs the agents, opens review
amx doctor                       # diagnoses install + config from any shell
```

That's the happy path. The [installation guide](getting-started/installation.md)
covers per-backend extras and per-platform notes; the [first run walkthrough](getting-started/first-run.md)
narrates a complete review session.

---

## License

AMX is open source under the [Apache License 2.0](https://github.com/omeryasirkucuk/amx/blob/main/LICENSE).
