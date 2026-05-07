---
title: AMX — Agentic Metadata Extractor
description: AI-powered CLI that documents undocumented database schemas. Reads your database, docs, and code; drafts column descriptions with confidence scores; lets a human review before anything lands.
hide:
  - navigation
  - toc
---

<h1 class="amx-visually-hidden">AMX — Agentic Metadata Extractor</h1>

<div class="amx-landing">

<section class="amx-landing__hero">
<div class="amx-landing__hero-bg" aria-hidden="true"></div>
<div class="amx-landing__hero-inner">
<span class="amx-landing__eyebrow">AGENTIC METADATA EXTRACTOR</span>
<img src="assets/amx-logo.png" alt="AMX" class="amx-landing__logo" width="406" height="183">
<p class="amx-landing__tagline">AI-powered CLI that documents undocumented database schemas. Reads your database, docs, and code; drafts column descriptions with confidence scores; lets a human review before anything lands.</p>
<div class="amx-landing__pitch" role="note">
<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4zm0 2.18L5 6.3v4.7c0 4.52 2.98 8.69 7 9.93 4.02-1.24 7-5.41 7-9.93V6.3l-7-3.12z"/></svg>
<span>Runs entirely on your machine or in your cloud. <strong>Self-hosted, on-prem, air-gapped</strong> — bring your own LLM, nothing leaves your perimeter.</span>
</div>
<div class="amx-landing__cta-row">
<a class="amx-landing__btn amx-landing__btn--primary" href="getting-started/">Get Started <span aria-hidden="true">→</span></a>
<a class="amx-landing__btn amx-landing__btn--ghost" href="https://github.com/omeryasirkucuk/amx" target="_blank" rel="noopener">View on GitHub</a>
</div>
<code class="amx-landing__install" title="Click to copy">pip install amx-cli</code>
<div class="amx-landing__meta">
<span><span class="amx-landing__meta-dot"></span> 10 database backends</span>
<span><span class="amx-landing__meta-dot"></span> 8 LLM providers</span>
<span><span class="amx-landing__meta-dot"></span> Apache-2.0</span>
</div>
</div>
<a href="#three-agents" class="amx-landing__scroll-down" aria-label="Scroll to features">
<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>
</a>
</section>

<section class="amx-landing__section" id="three-agents">
<h2 class="amx-landing__h2">Three agents. One review.</h2>
<p class="amx-landing__lede">Most metadata tools work column-by-column on the schema alone. AMX runs three specialist agents in parallel — across your database, your documentation, and your codebase — and merges the evidence before a human ever sees a draft.</p>
<img src="assets/amx-flow.png" alt="AMX components flow: Databases, Documents, and Codebase feed into AMX (Profile, RAG, and Code agents), which produces reviewed metadata accessible via Ask Metadata." class="amx-landing__flow">
<div class="amx-landing__features">
<div class="amx-landing__feature">
<div class="amx-landing__feature-pixel" aria-hidden="true"></div>
<h3>Multi-source evidence</h3>
<p>The Profile agent walks the schema. The RAG agent reads your documentation. The Code agent traces SQL/Python references. Drafts cite the rows the LLM read, so you never get a fabricated column name back.</p>
</div>
<div class="amx-landing__feature">
<div class="amx-landing__feature-pixel amx-landing__feature-pixel--green" aria-hidden="true"></div>
<h3>Self-hosted, BYO-LLM</h3>
<p>Runs entirely in your environment. OpenAI, Anthropic, Gemini, Databricks Serving, Ollama, vLLM, LM Studio — your choice. Schema names, sample values, generated descriptions and the audit trail all stay where you started.</p>
</div>
<div class="amx-landing__feature">
<div class="amx-landing__feature-pixel amx-landing__feature-pixel--blue" aria-hidden="true"></div>
<h3>Human-in-the-loop</h3>
<p>Confidence-scored drafts in batches. Review wizard with bulk-accept, then native <code>COMMENT ON</code> write-back to the warehouse you already speak. Whole-warehouse first-pass in minutes, not weeks.</p>
</div>
</div>
</section>

<section class="amx-landing__section amx-landing__demo">
<h2 class="amx-landing__h2">Two surfaces. One workflow.</h2>
<p class="amx-landing__lede">Drive AMX from the terminal with slash commands — <code>/setup</code>, <code>/run</code>, <code>/apply</code>, <code>/ask</code> — or open the local Studio for a clickable review. Same runs, same review queue, same audit trail.</p>
<div class="amx-landing__demos">
<div class="amx-landing__demo-item">
<p class="amx-landing__demo-caption"><span class="amx-landing__demo-caption-tag">CLI</span> Interactive session — slash command palette, dynamic config, and the review wizard.</p>
<div class="amx-landing__demo-frame">
<div class="amx-landing__demo-chrome" aria-hidden="true"><span></span><span></span><span></span></div>
<img src="assets/cli-hero.png" alt="AMX interactive session: banner, version, config path, active database and LLM profile, and the slash command palette." class="amx-landing__demo-img">
</div>
</div>
<div class="amx-landing__demo-item">
<p class="amx-landing__demo-caption"><span class="amx-landing__demo-caption-tag">Studio</span> Local web UI — overview dashboard, recent runs, and the pending review queue.</p>
<div class="amx-landing__demo-frame">
<div class="amx-landing__demo-chrome" aria-hidden="true"><span></span><span></span><span></span></div>
<img src="assets/studio-overview.png" alt="AMX Studio overview: active backend, LLM model, total runs, success rate, and a list of recent runs with status badges." class="amx-landing__demo-img">
</div>
</div>
</div>
</section>

<section class="amx-landing__section amx-landing__why-section">
<h2 class="amx-landing__h2">Why AMX</h2>
<div class="amx-why">
<div class="amx-why__pain">
<p><strong>The pain</strong>
Most AI metadata tools work <strong>column-by-column, schema-only</strong> — you approve generic suggestions one at a time, with no project context. Combining database + documentation + codebase evidence with a structured human review is rare; doing all four with native <code>COMMENT ON</code> write-back is rarer still.</p>
</div>
<div class="amx-why__angle">
<p><strong>The angle</strong>
Database <strong>+</strong> documentation <strong>+</strong> codebase <strong>+</strong> human review, run together. Drafts in batches with confidence scores, written back as the SQL your warehouse already speaks. Whole-warehouse first-pass in <strong>minutes</strong>, not weeks.</p>
</div>
<div class="amx-why__ask">
<p><strong>Ask it</strong>
Open a session with <code>/ask</code> and chat with the catalog you just built: <em>what joins to <code>customer</code>?</em>, <em>any columns missing descriptions?</em>, <em>what does <code>x_legacy_status</code> mean?</em>, <em>which tables haven't been touched in 90 days?</em>. Plain English in, grounded answers out — every response cites the exact catalog rows the LLM read, so you never get a fabricated column name back.</p>
</div>
<div class="amx-why__compliance">
<p><strong>Self-hosted</strong>
AMX runs entirely in your environment. <strong>No SaaS account, no data leaves your network</strong>, bring-your-own-LLM — including local models (Ollama, vLLM, LM Studio). The compliance question collapses to <em>nothing leaves your perimeter</em>: schema names, sample values, generated descriptions, the audit trail — all stay where you started. Released under the <strong><a href="https://github.com/omeryasirkucuk/amx/blob/main/LICENSE">Apache License 2.0</a></strong> — free for any use, including commercial.</p>
</div>
</div>
</section>

<section class="amx-landing__section amx-landing__cta">
<div class="amx-landing__cta-card">
<h2 class="amx-landing__h2">Five minutes to your first reviewed description.</h2>
<p class="amx-landing__lede">Install from PyPI, run <code>amx</code>, walk through the <code>/setup</code> wizard. The fastest way to evaluate.</p>
<code class="amx-landing__install amx-landing__install--lg">pip install amx-cli</code>
<div class="amx-landing__cta-row">
<a class="amx-landing__btn amx-landing__btn--primary" href="getting-started/quickstart/">5-minute Quickstart <span aria-hidden="true">→</span></a>
<a class="amx-landing__btn amx-landing__btn--ghost" href="getting-started/">Read the docs</a>
</div>
</div>
</section>

</div>
