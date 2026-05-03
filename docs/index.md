---
title: AMX — AI-powered database documentation
hide:
  - navigation
  - toc
---

<div class="amx-hero">
  <div class="amx-hero__content">
    <div class="amx-hero__badge">
      <span class="dot"></span>
      v0.12.0 · Shared history store · 10 backends
    </div>
    <h1>Database documentation,<br/><span class="grad">written by your data.</span></h1>
    <p class="amx-hero__sub">
      AMX walks your database, reads your documentation and codebase, then drafts a complete description for every table and column — with confidence scores and a human-in-the-loop review before anything lands in the live DB.
    </p>
    <div class="amx-hero__ctas">
      <a href="getting-started/quickstart/" class="md-button md-button--primary">Get started in 5 min</a>
      <a href="https://github.com/omeryasirkucuk/amx" class="md-button">★ Star on GitHub</a>
    </div>
    <div class="amx-hero__meta">
      <span><strong>10</strong> database backends</span>
      <span>·</span>
      <span><strong>7</strong> LLM providers</span>
      <span>·</span>
      <span><strong>Apache 2.0</strong> licensed</span>
      <span>·</span>
      <span><strong>Python 3.10+</strong></span>
    </div>
  </div>

  <div class="amx-codecard">
    <div class="amx-codecard__bar">
      <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="label">amx — interactive session</span>
    </div>
<pre><code><span class="c-com"># Cryptic identifier in:</span>
<span class="c-out">sap_s6p.t001.audat   NUMBER(8) NULL</span>

<span class="c-com"># Reviewed description out, after one /run:</span>
<span class="c-out">sap_s6p.t001.audat — </span><span class="c-str">Document date. The calendar date the source business event</span>
<span class="c-str">was recorded, distinct from posting date (BUDAT) which controls the accounting</span>
<span class="c-str">period the transaction lands in.</span>

  <span class="c-out">confidence:</span> <span class="c-ok">high</span> <span class="c-out">·</span> logprob: <span class="c-num">0.91</span> <span class="c-out">·</span> sources: code (3 refs), docs, db profile</code></pre>
  </div>
</div>

<section class="amx-section amx-section--center">
  <span class="amx-section__eyebrow">Why AMX</span>
  <h2 class="amx-section__title">Built for the way data teams actually work</h2>
  <p class="amx-section__lead">Three independent agents — Profile, RAG, and Code — merged through an orchestrator. Backend-neutral, provider-agnostic, with the cost knobs you need to keep warehouse and LLM bills bounded.</p>
</section>

<div class="amx-features">

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></svg>
    </div>
    <h3>Backend-agnostic</h3>
    <p>Ten supported databases. PostgreSQL, Snowflake, Databricks, BigQuery, MySQL, Oracle, SQL Server, Redshift, ClickHouse, and DuckDB — each adapter exposes its own first-class object types.</p>
    <a class="amx-feature__link" href="backends/">See backends</a>
  </div>

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 9V5M9 12H5M12 15v4M15 12h4"/></svg>
    </div>
    <h3>Multi-agent inference</h3>
    <p>Profile + RAG + Code agents run independently and merge through an orchestrator. Every suggestion carries its evidence sources and a calibrated logprob confidence.</p>
    <a class="amx-feature__link" href="concepts/agents/">How agents work</a>
  </div>

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    </div>
    <h3>Human in the loop</h3>
    <p>Nothing is written to your database without your review. Accept the top suggestion, pick from alternatives, write your own, or skip — bulk-accept high-confidence rows.</p>
    <a class="amx-feature__link" href="concepts/human-in-the-loop/">HITL review</a>
  </div>

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/><path d="M2 7l10 5 10-5"/><path d="M12 22V12"/></svg>
    </div>
    <h3>Cost guardrails</h3>
    <p><code>full</code> / <code>sampled</code> / <code>metadata</code> profiling modes keep warehouse cost bounded. Logprob-driven confidence calibration. Budget-aware batch sizes. OpenAI Batch for ~50% LLM cost reduction.</p>
    <a class="amx-feature__link" href="configuration/profiling-modes/">Profiling modes</a>
  </div>

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    </div>
    <h3>Team collaboration</h3>
    <p>Optional shared history store dual-writes runs to a backend the team already owns — so two engineers running AMX against the same warehouse can finally see each other's analyses.</p>
    <a class="amx-feature__link" href="collaboration/shared-history-store/">Shared history</a>
  </div>

  <div class="amx-feature">
    <div class="amx-feature__icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    </div>
    <h3>Library-first API</h3>
    <p><code>amx.init()</code> and <code>infer_table_metadata()</code> are part of the stable public surface. Use AMX from any Python script, notebook, or service without the CLI shell.</p>
    <a class="amx-feature__link" href="api/">Python API</a>
  </div>

</div>

<section class="amx-section amx-section--center" style="margin-top: 5rem;">
  <span class="amx-section__eyebrow">How it works</span>
  <h2 class="amx-section__title">Five minutes from install to documented columns</h2>
  <p class="amx-section__lead">No external services to deploy. AMX runs entirely on your machine with your existing database and LLM credentials.</p>
</section>

<div class="amx-steps">
  <div class="amx-step">
    <h3>Install &amp; connect</h3>
    <p>Pick the extras for the databases you actually use. AMX walks you through DB and LLM profiles in an interactive wizard.</p>
    <code>pip install "amx[postgresql,snowflake]"</code>
  </div>
  <div class="amx-step">
    <h3>Run the agents</h3>
    <p>Profile the database, retrieve from your docs and codebase, merge through the orchestrator. Live progress, per-column status.</p>
    <code>/run sap_s6p.t001</code>
  </div>
  <div class="amx-step">
    <h3>Review &amp; apply</h3>
    <p>Walk the wizard or bulk-accept high-confidence rows. Write back via the backend's native comment SQL — never silently.</p>
    <code>/apply</code>
  </div>
</div>

<section class="amx-section amx-section--center" style="margin-top: 5rem;">
  <span class="amx-section__eyebrow">Backends</span>
  <h2 class="amx-section__title">Ten databases, one workflow</h2>
  <p class="amx-section__lead">Each adapter normalises through the Universal Metadata Interface, so the agents and review wizard treat every backend identically.</p>
</section>

<div class="amx-backends">
  <a class="amx-backend" href="backends/postgresql/"><span class="amx-backend__dot"></span>PostgreSQL</a>
  <a class="amx-backend" href="backends/snowflake/"><span class="amx-backend__dot"></span>Snowflake</a>
  <a class="amx-backend" href="backends/databricks/"><span class="amx-backend__dot"></span>Databricks</a>
  <a class="amx-backend" href="backends/bigquery/"><span class="amx-backend__dot"></span>BigQuery</a>
  <a class="amx-backend" href="backends/mysql/"><span class="amx-backend__dot"></span>MySQL</a>
  <a class="amx-backend" href="backends/oracle/"><span class="amx-backend__dot"></span>Oracle</a>
  <a class="amx-backend" href="backends/mssql/"><span class="amx-backend__dot"></span>SQL Server</a>
  <a class="amx-backend" href="backends/redshift/"><span class="amx-backend__dot"></span>Redshift</a>
  <a class="amx-backend" href="backends/clickhouse/"><span class="amx-backend__dot"></span>ClickHouse</a>
  <a class="amx-backend" href="backends/duckdb/"><span class="amx-backend__dot"></span>DuckDB</a>
</div>

<div class="amx-stats">
  <div><span class="amx-stat__num">10</span><span class="amx-stat__lbl">DB backends</span></div>
  <div><span class="amx-stat__num">7</span><span class="amx-stat__lbl">LLM providers</span></div>
  <div><span class="amx-stat__num">3</span><span class="amx-stat__lbl">Inference agents</span></div>
  <div><span class="amx-stat__num">~50%</span><span class="amx-stat__lbl">Cost via Batch</span></div>
</div>

<section class="amx-section">
  <div class="amx-release">
    <span class="amx-release__tag">v0.12.0 · Latest release</span>
    <h3>Shared run-history store + six new backends</h3>
    <p>
      AMX has always kept its run history in a single SQLite file at <code>~/.amx/history.db</code> — fine for one engineer, invisible to teammates. 0.12.0 introduces an optional shared mode that dual-writes runs to a backend the team already owns. Plus six new database adapters: MySQL, Oracle, SQL Server, Redshift, ClickHouse, DuckDB.
    </p>
    <a class="amx-feature__link" href="changelog/">Read the full changelog</a>
  </div>
</section>

<section class="amx-section amx-section--center" style="margin-top: 5rem;">
  <span class="amx-section__eyebrow">From the Python API</span>
  <h2 class="amx-section__title">Headless inference in three lines</h2>
  <p class="amx-section__lead"><code>amx.core</code> is a small, stable surface — semver-tracked from 1.0. Use it from notebooks, batch jobs, or production services.</p>
</section>

<div class="amx-codecard" style="margin-top: 2rem; max-width: 760px;">
  <div class="amx-codecard__bar">
    <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
    <span class="label">infer.py</span>
  </div>
<pre><code><span class="c-key">import</span> amx
<span class="c-key">from</span> amx.core <span class="c-key">import</span> infer_table_metadata

app = amx.<span class="c-fun">init</span>()                      <span class="c-com"># loads ~/.amx/config.yml</span>
results = <span class="c-fun">infer_table_metadata</span>(
    app.config, schema=<span class="c-str">"sap_s6p"</span>, table=<span class="c-str">"t001"</span>,
    include_rag=<span class="c-key">True</span>, include_codebase=<span class="c-key">True</span>,
)

<span class="c-key">for</span> col <span class="c-key">in</span> results:
    <span class="c-fun">print</span>(<span class="c-str">f"{col['column']:30s}  {col['confidence']:8s}  {col['description']}"</span>)</code></pre>
</div>

<div class="amx-cta">
  <h2>Ship documentation, not maintenance</h2>
  <p>AMX is open source under Apache 2.0. Five minutes to first description, no external services, no vendor lock-in.</p>
  <div class="amx-hero__ctas">
    <a href="getting-started/installation/" class="md-button md-button--primary">Install AMX</a>
    <a href="concepts/architecture/" class="md-button">Read the architecture</a>
  </div>
</div>
