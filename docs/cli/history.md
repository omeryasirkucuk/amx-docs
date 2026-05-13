# `/history` & `/usage`

Every `/run`, `/run-apply`, `/ask`, and `/apply` lands in the local SQLite store at
`~/.amx/history.db`. `/history` is the read interface; `/usage` summarises token counts
over a window.

## What's persisted

- `/analyze run` history (status, mode, duration, backend / provider / model, scope)
- Token usage (summary + per-step records)
- Approved / skipped metadata results
- Run failures (error text)
- App events (profile switches, run status, apply outcomes, …)
- **All LLM-generated alternatives per column / table per run** — every merged suggestion
  set is saved before human review so you can revisit and change your mind at any time.
- **Apply events** (`apply_events` table, AMX 0.13+) — one row per successful
  COMMENT write with the prior text, the new text, the run id, and the
  user / host / profile. Powers [`/history rollback`](#rollback) and Studio's
  [Audit page](../studio/audit.md).

## `/history` namespace

| Command | Description |
|---|---|
| `/list [-n N]` | Recent runs (includes `Duration(s)` and `Model(s)`) |
| `/show <run_id>` | Full run JSON (scope, metrics, tokens, results, errors) |
| `/stats` | Aggregate stats + search lifecycle counts |
| `/events [-n N]` | App events (profile switches, run status, apply outcomes, …) |
| `/results <run_id>` | All saved LLM alternatives for a past run |
| `/review <run_id>` | Re-evaluate alternatives interactively |
| `/rollback <run_id>` | Restore the COMMENTs that this run overwrote |
| `/compare [RUN_IDS…] [flags]` | Pivot runs side-by-side |

## Re-reviewing past runs

```text
/history review <run_id>                       # walk every column again
/history review <run_id> --unevaluated-only    # only columns you skipped
/history review <run_id> --apply               # short-circuit to writing on accept
```

Useful when:

- You ran the agents weeks ago and your domain knowledge has improved.
- A column you skipped now has clearer evidence (new code / docs ingested since).
- You want to compare suggestions from two different LLM profiles side-by-side before
  committing.

## `/rollback`

`/history rollback <run_id>` undoes a past `/apply` by restoring the
COMMENT each affected asset had **immediately before** the run wrote
to it.

```text
amx /history rollback 42                # interactive (preview + confirm)
amx /history rollback 42 --yes          # scripted; skip the prompt
```

Backed by the `apply_events` audit table — every successful
COMMENT write records the prior text alongside the new one, so
rollback restores **whatever was on the asset before**, not just
"what AMX wrote". The DBA's hand-typed comment, an export-tool's
default text, a previous AMX run's output — all valid sources to
roll back to.

### What rollback shows you first

```text
═══ Rollback run #42 ═══
Found 3 apply event(s); 3 restorable, 0 skipped (original unknown).

Will restore
  Asset                                Current (will be replaced)         Restoring to
  core.transactions.posting            Posting date encoded as YYYY…      Posting date (manual; legacy)
  core.transactions.amount             Amount in transaction currency…    Total amount in cents
  core.transactions.eff_dt             Effective date the row landed…     Warehouse arrival date

Restore 3 comment(s) by overwriting current values? [y/N]:
```

### Skipped rows (`old_comment` unknown)

Some rows surface as **skipped**: the audit row's `old_comment` is
`NULL`. Two situations produce this:

- The apply ran before the audit log started capturing pre-write
  values (anything before AMX 0.13).
- The active backend's adapter doesn't expose a comment-read API,
  so AMX could not capture the prior text.

Rollback never invents text — skipped rows are reported in the
summary and left untouched. To recover them, restore from a DB
backup or rerun the original DBA script.

### Replay order

When a single run wrote to the same asset multiple times (rare but
possible — e.g. a chained schema → table → column meta-apply),
rollback replays in **reverse time order**. The last write unwinds
first so the asset ends up holding whatever it had **before** the
run started.

### Failure handling

The rollback runs inside one `engine.begin()` transaction.
Per-row failures are reported but do not abort the rest:

```text
  ✓ core.transactions.posting
  ✗ core.transactions.amount: COMMENT requires schema USAGE
  ✓ core.transactions.eff_dt

⚠ Restored 2 of 3; 1 failed.
```

The failed rows stay on the run's `apply_events` so a retry after
fixing the privilege grant resumes from the same audit trail.

## `/compare`

`/history compare` pivots multiple runs side-by-side across four Rich tables — run
summary, run settings, per-column descriptions, aggregate metrics — and adds an academic
**Quality metrics** panel that scores actual *correctness* rather than the LLM's
self-confidence (which `logprob_score` alone measures, with well-known overconfidence
bias).

### Tables

1. **Run summary** — identity (profiles, model, duration, approval rate). Highlights the
   dimension that varies between runs.
2. **Run settings** — prompt detail, language, batch size, n alternatives, dedup /
   missing-only flags, review strategy. Exactly which knobs you tuned between runs.
3. **Per-column results** — top description + confidence band + `logprob_score` + tokens.
   Best logprob per row in green.
4. **Aggregate metrics** — timing + tokens + confidence distribution. Best per row bolded.
5. **Quality metrics** *(new)* — chrF, ROUGE-L, schema grounding, length appropriateness,
   type-token ratio, optional embedding agreement and LLM-judge win-rate. See
   [Quality framework](#quality-metric-framework) below.

### Studio modal

Clicking **Compare** in `amx /studio` opens the picker at `/runs/compare`:

- **Paged picker** — sticky-header page-size selector (10 / 20 / 50 / 100, persisted in
  `localStorage`), Prev / Next, "Clear selection". Search + kind filters (analyze /
  rerun / generate / ask) compose with paging.
- **Modal results** — pick at least 2 runs, click Compare, the comparison opens in a
  full-width Dialog over the picker. The picker stays visible underneath so you can
  iterate on the selection. Previous behaviour (result rendered below the picker) was
  removed in 0.15.
- **Set baseline** — once a run is picked, a small **Set baseline** button appears next
  to it. Click to pin that run as the academic ground-truth baseline for reference-based
  metrics (chrF, ROUGE-L, BERTScore). Click again to unpin. Mirrors `--ground-truth-run`
  on the CLI.
- **Run deeper analysis** — the modal footer carries a `Sparkles` button that triggers
  Tier 1 (sentence-transformer embeddings) + Tier 2 (LLM-as-judge tournament). A
  cost-preview Dialog confirms before any LLM token is spent. The result replaces the
  Tier 0 view in the same modal.
- **Ask AMX** — modal footer button. Closes the modal and seeds a chat at `/ask` with
  the comparison context preloaded; the LLM uses the new `compare_runs` tool to fetch
  detail itself if it needs more.
- **Download PDF** — landscape A4 dark-themed report, AMX logo on every page,
  warm-stone palette identical to the modal, `Methods` section with full bibliographic
  citations.

### CLI flags

| Flag | Description |
|---|---|
| `--last N` | Compare the last N runs |
| `--schema NAME` | Restrict to one schema |
| `--table NAME` | Restrict to one table |
| `--column NAME` | Restrict to one column |
| `--command analyze.run\|search.ask\|all` | Filter by command type |
| `--by auto\|llm_profile\|doc_profile\|code_profile\|llm_model\|db_profile` | Group by dimension |
| `--diff` | Word-level highlights vs the leftmost run |
| `--csv FILE` | Also write the comparison as CSV |
| `--md FILE` | Also write as markdown |
| `--json FILE` | Also write as JSON |
| `--quality basic\|full\|none` | Quality metric tier (default `basic` = Tier 0) |
| `--ground-truth-run ID` | Pin one of the runs as the academic baseline |

JSON output pairs cleanly with pandas / Jupyter. The shape is documented in the AMX repo
under `tests/eval/README.md`. The keys `schema_version`, `run_summary`, `per_column`, and
`aggregate_metrics` are stable.

### Quality metric framework

`/history compare` historically picked a "winner" by highest `logprob_score`. Logprob is
the LLM's *self-confidence*; it correlates with overconfidence bias and tells you nothing
about whether the description is actually correct. The Quality framework replaces that
with three tiers of academic metrics, opt-in by cost.

#### Reference resolution waterfall

Reference-based metrics (chrF, ROUGE-L, BERTScore, Levenshtein) need a ground truth.
AMX walks four sources in order:

1. **User pin** — `--ground-truth-run ID` on the CLI, "Set baseline" radio in Studio.
2. **Live DB COMMENT** — `COMMENT ON COLUMN` / `COMMENT ON TABLE` from the active DB
   profile. SQL-standard, the most authoritative ground-truth proxy when the team has
   already documented the column upstream.
3. **Catalog applied** — most recent `apply_events` row for the same asset (the last
   description AMX wrote to the DB).
4. **None** — reference-based metrics short-circuit cleanly. Reference-free metrics
   (length, type-token ratio, schema grounding, embedding agreement, LLM judge) still
   run.

The Studio modal Quality card shows a one-line resolution summary so you know whether
the chrF / ROUGE numbers had a real ground truth or fell back to a baseline run.

#### Tier 0 — offline, deterministic, free

Always on with `--quality basic` (default).

| Metric | Reference required | Citation | Library |
|---|---|---|---|
| **Length appropriateness** | no | (heuristic) | stdlib |
| **Type-token ratio (TTR)** | no | Templin 1957 | stdlib |
| **Schema grounding** | no | Jaccard 1912 token containment | stdlib |
| **chrF** | yes | Popović 2015 | `sacrebleu` |
| **ROUGE-L** | yes | Lin 2004 | `rouge-score` |
| **Levenshtein edit distance** | yes | Levenshtein 1966 | `difflib` |

```sh
pip install amx-cli[quality]   # sacrebleu + rouge-score
```

#### Tier 1 — local sentence embeddings (free, opt-in)

Fired by `--quality full` on the CLI or "Run deeper analysis" in Studio.

- **Embedding agreement matrix** — for each asset, pairwise cosine similarity between
  the runs' descriptions. High = the run agrees with the consensus; low = outlier.
- **Semantic schema grounding** — cosine similarity between the description embedding
  and a synthetic schema-anchor embedding (`table.column (dtype)`).
- **BERTScore** *(optional)* — Zhang et al. 2020. Heavier (~400MB model). Opt-in via
  the `bertscore` extra.

```sh
pip install amx-cli[quality,local-embeddings]    # all-MiniLM-L6-v2 default
pip install amx-cli[quality,bertscore]           # + BERTScore
```

#### Tier 2 — LLM-as-judge (opt-in, consumes tokens on the active LLM)

G-Eval pairwise tournament (Liu et al. 2023; Prometheus 2 — Kim et al. 2024 — uses the
same evaluator family). For each asset and each pair `(run_a, run_b)`, the active LLM
returns:

```json
{"winner": "A" | "B" | "tie", "reasoning": "<one sentence>", "confidence": 0.0-1.0}
```

Per-run **win-rate** (`wins / pairings`) is the headline aggregate. Cost rolls into the
run's `tokens_json`. Cached by `(run_a, run_b, asset)` so duplicate calls don't re-bill.

A typical 50-column × 3-run comparison runs ~150 judge calls; on `gpt-4o-mini` that's
roughly **$0.01–$0.02**.

### Examples

Compare the last three runs with the default Tier 0 quality panel:

```text
/history compare --last 3
```

Pin run 60 as the ground truth and run the full Tier 1+2 pipeline:

```text
/history compare 58 59 60 --quality full --ground-truth-run 60
```

Export to JSON for downstream analysis:

```text
/history compare --last 5 --schema my_schema --json /tmp/runs.json
```

### Ask AMX integration

Natural-language compare via the `compare_runs` LLM tool. Two examples:

```text
> compare runs 58, 59 — which is more accurate?
```

The agent calls `compare_runs(run_ids=[58, 59], quality_tier=1)` and explains *why* each
run wins per metric — not just the numbers. Sample response style:

> #58 wins on schema grounding (0.84 vs 0.52, Jaccard 1912) because its descriptions
> reference both the column name and dtype, whereas #59 stays generic. #59 wins on chrF
> (Popović 2015) by a small margin against the live DB COMMENT — closer to the existing
> wording the team agreed on.

```text
> I ran analyze on the address table last week — please compare those runs
```

The agent first calls `list_past_runs(table="address")` to resolve candidate IDs, then
`compare_runs` with the matching set.

### Academic methods

Bibliographic references for the Quality framework. The Studio modal renders this as a
collapsed footnote under the Quality card; the PDF report prints it as a `Methods`
section at the bottom.

- **chrF** — Popović, M. (2015). chrF: character n-gram F-score for automatic MT
  evaluation. WMT 2015. <https://aclanthology.org/W15-3049/>
- **ROUGE-L** — Lin, C.-Y. (2004). ROUGE: A Package for Automatic Evaluation of
  Summaries. ACL workshop. <https://aclanthology.org/W04-1013/>
- **BERTScore** — Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020).
  BERTScore: Evaluating Text Generation with BERT. ICLR 2020.
  <https://arxiv.org/abs/1904.09675>
- **G-Eval** — Liu, Y., Iter, D., Xu, Y., Wang, S., Xu, R., & Zhu, C. (2023). G-Eval:
  NLG Evaluation using GPT-4 with Better Human Alignment. EMNLP 2023.
  <https://arxiv.org/abs/2303.16634>
- **Prometheus 2** — Kim, S., Suk, J., Longpre, S., et al. (2024). Prometheus 2: An
  Open Source Language Model Specialized in Evaluating Other Language Models. EMNLP
  2024. <https://arxiv.org/abs/2405.01535>
- **Type-token ratio** — Templin, M. C. (1957). Certain Language Skills in Children.
  University of Minnesota Press.
- **Levenshtein distance** — Levenshtein, V. I. (1966). Binary codes capable of
  correcting deletions, insertions, and reversals. Soviet Physics Doklady, 10(8).
- **Jaccard similarity (schema grounding)** — Jaccard, P. (1912). The Distribution of
  the Flora in the Alpine Zone. New Phytologist, 11(2), 37–50.

## `/usage`

```text
/usage             # last 7 days (default)
/usage 24h
/usage 30d
/usage all
```

Reads from `~/.amx/history.db` only — **no network calls**. The summary breaks down
prompt and completion tokens per LLM profile and per model, so you can see which models
your team uses most.

## Where it lives on disk

```
~/.amx/
├── config.yml
├── history.db          # SQLite — the table set described above
└── logs/amx.log
```

The SQLite schema is part of the public contract — additive migrations within a major
version, column types and meanings stable. See [Python API](../api/index.md#on-disk-formats)
for the full guarantees.

## Sharing history across a team

By default `~/.amx/history.db` is per-machine. Enable [shared mode](../collaboration/shared-history-store.md)
to dual-write every run, result, and event to a backend the team already owns. Reads still
come from local SQLite — cross-machine read views are slated for a follow-up minor.
