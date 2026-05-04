---
title: Benchmarks
description: Where AMX stands on independent benchmarks for AI-generated database descriptions, and the evaluation protocol we plan to publish.
---

# Benchmarks

!!! warning "Status — planned"
    AMX has **not yet** published external benchmark numbers for AI-generated
    column descriptions. This page is here for transparency: it explains the
    evaluation gap honestly, names the protocol AMX will adopt, and lays out
    a contribution path so the community can help close it.

## The state of the field

There is **no widely-accepted public benchmark for AI-generated database
descriptions**. The two related academic benchmarks measure something else:

| Benchmark | Measures | Relevance to AMX |
|---|---|---|
| [BIRD](https://bird-bench.github.io/) | Text-to-SQL execution accuracy across 12,751 questions / 95 databases | Tests *querying* a documented schema, not *generating* the documentation |
| [Spider](https://yale-lily.github.io/spider) | Cross-domain text-to-SQL on 200 databases | Same — assumes documentation already exists |

Neither evaluates "is this generated description faithful to the column's
real meaning?" — which is what AMX produces. The closest existing protocol
is the one published by **Databricks in their 2024 AI Comments preview**:
62 schemas drawn from production workloads, two human reviewers + an LLM
judge, measuring human preference rate of generated descriptions vs. the
prior baseline. We treat that paper as the de facto methodology.

## What AMX *does* report internally

Every `/run` already records a per-column **logprob-derived confidence
band**:

| Band | Definition |
|---|---|
| `verified` | Token-level confidence ≥ 0.95 across the entire description; cross-checked against profile + RAG + code evidence |
| `high_likelihood` | Confidence ≥ 0.85; majority of evidence sources agreed |
| `possible` | Confidence ≥ 0.50; at least one evidence source agreed |
| `weak_hypothesis` | Below 0.50; surfaced for review with no auto-accept |

These bands are **internal calibration**, not public benchmarks. They
help the human reviewer triage what to read first; they don't tell an
external buyer how AMX compares against, say, Snowflake Cortex on the
same 62 schemas.

## The planned evaluation

The Databricks-style protocol AMX will publish:

1. **Dataset** — 50–80 production schemas, anonymised, drawn from at least
   four backends (PostgreSQL, Snowflake, BigQuery, Databricks) and three
   domains (e.g. e-commerce, healthcare, ERP-style enterprise). Open
   release of the schema-and-ground-truth pairs as a benchmark dataset
   in its own right.
2. **Baselines** — at minimum: AMX (with `gpt-4o`, `claude-sonnet-4`,
   and `gemini-2.0-flash`), Snowflake Cortex `AI_GENERATE_TABLE_DESC`
   on its supported subset, Databricks AI Comments via Catalog Explorer,
   BigQuery Gemini Insights.
3. **Reviewers** — two domain experts per schema, blind to the source
   tool. A third tie-break reviewer when the first two disagree.
4. **LLM judge** — a fixed `gpt-4o-2024-11-20` snapshot scoring each
   description on a 5-point rubric (faithfulness, specificity, clarity,
   actionability, no-hallucination).
5. **Metrics** — preference rate vs. the original `COMMENT ON` text
   (where one exists) and pairwise win-rate against each baseline.
6. **Reproducibility** — full prompts, model versions, and reviewer
   guidelines published alongside the numbers. Anyone with the dataset
   should be able to re-run the protocol against their own tool.

## Help close the gap

If you'd like to contribute to AMX's first benchmark — schema donations,
expert reviewers in a specific domain, or co-authoring the methodology
paper — open a discussion at
[github.com/omeryasirkucuk/amx/discussions](https://github.com/omeryasirkucuk/amx/discussions)
or email [omeryasirkucuk@gmail.com](mailto:omeryasirkucuk@gmail.com).

## What's next

- [Comparisons](comparisons.md) — feature-by-feature comparison against the major AI-metadata tools, with explicit notes on which claims are evidenced and which are pending the benchmark above.
- [Run & Apply](../cli/run-and-apply.md) — confidence-band scoring at runtime.
- [`/ask` and `/search`](../cli/ask-and-search.md) — the live Q&A surface that goes on top of any descriptions you generate.
