# Retrieval evaluation harness

AMX ships a small, offline-runnable evaluation harness for the docs
RAG pipeline. Every retrieval-architecture change is gated against a
committed baseline so a code change that quietly degrades answer
quality fails CI rather than landing on `main`.

## What it measures

The harness ingests a synthetic six-document plain-text corpus
(orders / customers / products / inventory / glossary / ETL — the
content is Markdown-formatted but the files are saved as `.txt` so
ingest uses the dependency-free `TextLoader`) into a fresh
`RAGStore`, runs 20 gold-set questions through the live retrieval
surface, and reports source-level metrics:

| Metric | Reads |
| --- | --- |
| `hit@1`, `hit@3`, `hit@5` | Did the right document show up in the top-N? |
| `MRR` | At what rank did the first correct document appear? |
| `precision@5` | What fraction of the top-5 unique sources are relevant? |
| `nDCG@5` | Rank-weighted precision (logarithmic discount). |
| `keyword_recall` | Did the retrieved chunks contain the expected answer terms? |

The hits-to-sources projection deduplicates by filename while
preserving rank order — five chunks from the same file count once
when judging whether the **document** surfaced, regardless of how
many of its chunks landed in the window.

## Where it lives

| Path | Role |
| --- | --- |
| `tests/eval/metrics.py` | Pure scoring functions (`hit@k`, `MRR`, `nDCG@k`, …). |
| `tests/eval/runner.py` | End-to-end driver against the real `RAGStore`. |
| `tests/eval/fixtures/docs/` | Synthetic plain-text corpus (Markdown-formatted content, `.txt` extension). |
| `tests/eval/fixtures/docs_gold.jsonl` | Gold set: 20 question / expected-source / expected-content triples. |
| `tests/eval/baselines/docs_baseline.json` | The committed CI floor. |
| `tests/eval/test_baselines.py` | The CI gate. |
| `tests/eval/generate_baselines.py` | Regenerates the baseline JSON. |

## How to run

The harness runs as part of the standard test suite:

```bash
pytest tests/eval/
```

Two tests in particular:

- `test_docs_eval_runner_smoke` — always on. Asserts the runner
  executes end-to-end and surfaces a relevant document for at least
  half of the gold-set questions. Catches a broken runner before the
  baseline test ever sees it.
- `test_docs_eval_no_regression_vs_baseline` — skipped if the
  baseline file is missing (useful during initial scaffolding);
  otherwise asserts no regression vs the committed baseline.

Total runtime is ~6 s on the CI matrix. The harness uses the bundled
MiniLM embedder so there is no network call and no model download —
it honours `AMX_NO_NETWORK=1`.

## CI gates

The baseline test fails the build if any of the following regress
beyond their tolerance:

| Metric | Rule | Tolerance |
| --- | --- | --- |
| `hit@3` | new ≥ baseline | 0 pp (hard floor) |
| `precision@5` | new ≥ baseline − 0.02 | 2 pp |
| `MRR` | new ≥ baseline − 0.03 | 3 pp |
| `nDCG@5`, `keyword_recall` | tracked, not gated | — |

The hard floor on `hit@3` is the load-bearing assertion: it does not
tolerate any regression. The other tolerances absorb small variance
from reranker tweaks without letting a real degradation slip through.

## Updating the baseline

When a PR changes retrieval behaviour intentionally — a new
embedder, a new chunker, hybrid retrieval, a re-ranker — regenerate
the baseline and commit the new JSON in the same PR so the metric
delta is visible to reviewers:

```bash
python -m tests.eval.generate_baselines --print
git add tests/eval/baselines/docs_baseline.json
git commit -m "feat(retrieval): switch to hybrid FTS5+vector

eval delta:
  hit@3:        0.90 -> 0.95 (+0.05)
  MRR:          0.80 -> 0.86 (+0.06)
  precision@5:  0.27 -> 0.31 (+0.04)
"
```

The CI workflow does not auto-update the baseline. A baseline change
is always an explicit author action with a reason in the commit
message.

## Adding to the gold set

The synthetic corpus is intentionally small so the harness runs in
seconds. To strengthen coverage:

1. Add a plain-text file to `tests/eval/fixtures/docs/` (`.txt`
   extension keeps CI offline; use `.md` only if your environment
   has the `markdown` PyPI package).
2. Add the relevant question rows to
   `tests/eval/fixtures/docs_gold.jsonl` — each row is one JSON object
   with `id`, `question`, `expected_sources` (list of filenames), and
   optional `expected_answer_contains` (list of tokens).
3. Regenerate the baseline.
4. Commit the corpus addition, the gold-set addition, and the new
   baseline together — the baseline-gate test detects gold-set size
   changes and fails if they're not accompanied by a rebaseline.

## Per-corpus evaluation

The bundled corpus is synthetic on purpose — it must run offline in
CI. To evaluate against a real corpus locally:

```python
from pathlib import Path
from tests.eval.runner import run_docs_eval

report = run_docs_eval(
    persist_dir=Path("/tmp/eval-chroma"),
    fixture_dir=Path("./my-docs"),
    gold_path=Path("./my-gold.jsonl"),
)
print(report.to_baseline_dict())
```

The metric logic is re-usable; only the `fixture_dir` and `gold_path`
arguments change. To compare embedding providers on the same corpus,
swap the `cfg.embedding_docs.kind` setting in between runs — or
`cfg.embedding_code.kind` when evaluating code retrieval — and report
per-query deltas alongside the aggregate. The two sides are independent,
so a docs-side change does not affect code retrieval and vice versa.
