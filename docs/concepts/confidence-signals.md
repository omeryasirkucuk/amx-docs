# Confidence signals

Every alternative that AMX produces carries a per-alternative
**confidence score** — a small green / orange / red pill on each row
that tells you how strongly the system believes in that particular
candidate. The score is what powers the `HIGH / MED / LOW` bands you
see in the CLI's progress output and in every Studio results panel.

The signal that drives the score is configurable. Different scorers
catch different failure modes, cost different amounts of tokens, and
need different things from your LLM provider — so AMX exposes the
choice on each LLM profile.

## How to read a score in 30 seconds

* **HIGH** (`green`) — the system found strong agreement on this
  alternative. Safe to auto-apply when you trust the rest of the
  evidence (column name, samples, comments).
* **MED** (`orange`) — tie-breaker territory. Worth reviewing
  manually; the model wasn't confident enough to put this one above
  the rest.
* **LOW** (`red`) — the system disagrees with itself. Do **not**
  auto-apply this row; either pick a different alternative, refine
  the prompt, or rerun the column with more context.

Bands are computed from a single numeric score in the range
`[0.0, 1.0]` using two thresholds on the profile
(`confidence.bands.high`, `confidence.bands.med` — default
`0.75` / `0.50`). Tune them if your domain needs stricter or looser
gating.

## Why we expose more than one scorer

There is no single "right" way to score an alternative — each scorer
is a different lens:

* Some scorers (`self_consistency`) embed the alternatives and check
  how clustered they are; cheap, runs locally, works with any
  provider.
* Some scorers (`logprob`) ask the LLM provider to return per-token
  probabilities — accurate but only available on providers that
  expose log-probabilities.
* Some scorers (`self_decl`, `judge`) consume extra LLM tokens for a
  stronger answer; you pay for that signal.

AMX lets you pick one per profile so you can match the scorer to your
provider, budget, and trust requirements.

## The five available signals

The active signal is set via `LLMConfig.confidence_signal` in the
profile. Valid values: `self_consistency` (default), `logprob`,
`self_decl`, `judge`, `none`.

### `self_consistency` (SC) — default

* **What it measures**: how close each alternative is, in meaning, to
  the other `N-1` alternatives generated for the same column.
* **How it's computed**: AMX embeds every alternative with a local
  sentence-transformer (`all-MiniLM-L6-v2`, ~80 MB, CPU-friendly,
  deterministic offline) and scores each one as its **mean cosine
  similarity to the other alternatives**. The "centroid" cluster
  receives high scores; an outlier alternative receives a low score.
* **Score range**: `0.0` (totally dissimilar) → `1.0` (identical).
* **Interpretation**: high SC = the LLM produced a tight cluster of
  paraphrases for this column. Low SC on one alternative = that one
  disagrees with the others. Read alongside the
  [`alternatives_mode`](alternatives-mode.md): semantic mode is
  *expected* to produce high SC across all alternatives (they're all
  paraphrases of the same meaning); lexical mode is *expected* to
  produce more spread (alternatives carry different candidate
  meanings).
* **Cost**: zero LLM tokens. Local embedding only. Works with any
  provider.
* **Needs**: `n_alternatives >= 2`. With `N == 1` AMX falls back to a
  degenerate `1.0` so downstream math stays well-defined.
* **Source**: `amx/llm/confidence/self_consistency.py`.

### `logprob` (LP)

* **What it measures**: how confident the LLM itself was when it
  generated each alternative's tokens.
* **How it's computed**: AMX asks the provider to return per-token
  log-probabilities for the generated response, identifies the span
  of tokens that belongs to each `DESCRIPTION_i`, and averages /
  normalises the log-probability over that span.
* **Score range**: a normalised `[0.0, 1.0]` derived from the raw
  log-prob via `confidence.logprob_high` and `logprob_medium`
  thresholds. Closer to `1.0` = the model was very confident; closer
  to `0.0` = it was guessing.
* **Interpretation**: HIGH means the LLM saw a low-entropy
  distribution at every step of the answer — its next-token choice
  was rarely close to a tie. LOW means it was hopping between
  candidates as it wrote, which usually means the column name + samples
  didn't give it a clear signal.
* **Cost**: zero extra LLM tokens. But many providers do NOT expose
  log-probs (Anthropic, most Bedrock paths, Vertex sometimes). When
  the provider doesn't return them, AMX records `None` and the
  signal degrades to "unavailable" on that row.
* **Needs**: provider with log-probs. Set
  `LLMConfig.force_logprobs: true` to require the provider call to
  include them.
* **Source**: `amx/llm/confidence/logprob_span.py`.

### `self_decl` (SD)

* **What it measures**: the LLM's *own* self-reported confidence per
  alternative.
* **How it's computed**: AMX appends a `CONFIDENCE_i: <HIGH|MED|LOW>`
  line to the prompt after every `DESCRIPTION_i:` slot. The model
  answers a band directly; AMX maps the bands to numeric scores
  (`HIGH=0.9`, `MED=0.6`, `LOW=0.3`).
* **Score range**: a discrete `{0.3, 0.6, 0.9}` derived from the
  emitted band. The continuous-looking pill in Studio rounds the
  emitted band into the corresponding numeric.
* **Interpretation**: subjective. The model's self-assessment isn't
  always calibrated — it can be over-confident on plausible-looking
  but wrong descriptions. Treat as a *second opinion* alongside
  another signal, not as ground truth.
* **Cost**: small. One extra line per alternative in the prompt and
  one in the response — typically <50 tokens per column.
* **Source**: `amx/llm/confidence/self_declaration.py`.

### `judge` (JU)

* **What it measures**: a *separate* LLM call ranks the `N`
  alternatives best-to-worst, given the same evidence the original
  generation saw.
* **How it's computed**: after the per-agent merge, AMX issues one
  additional `chat.completions` call asking the model to score the
  generated alternatives. The scores are normalised to `[0.0, 1.0]`.
* **Score range**: `[0.0, 1.0]`.
* **Interpretation**: high score = the judge LLM agreed this is the
  most defensible interpretation. Lower scores expose alternatives
  the judge would not choose. Useful when you want a fully
  LLM-driven ranking signal and don't trust embedding-only proxies.
* **Cost**: roughly **doubles** the per-suggestion token spend on
  the active LLM. Use sparingly — typically only on small scopes you
  want a second opinion on.
* **Source**: `amx/llm/confidence/judge.py`.

### `none`

* **What it measures**: nothing. Per-alternative scoring is disabled.
* **Interpretation**: every alternative renders without a confidence
  pill. Use this when you only care about `DESCRIPTION_1` and don't
  need any ranking inside the alternates list.
* **Cost**: zero tokens, zero local compute.

## Bands and thresholds

Every numeric score is bucketed into a band using the profile's
threshold pair:

```yaml
llm:
  confidence:
    enabled: true
    bands:
      high: 0.75    # score >= 0.75  → HIGH (green)
      med:  0.50    # score >= 0.50  → MED  (orange)
                    # score <  0.50  → LOW  (red)
```

Defaults are conservative — most production runs leave them
unchanged. If you find too many rows are landing as `MED` and you'd
rather see them auto-applied, raise `high`; if you find AMX is
auto-applying rows you would have flagged, lower `high` (or raise the
band thresholds for the SC scorer specifically).

### Per-mode band expectations

Once you pick an
[`alternatives_mode`](alternatives-mode.md), the *expected* SC
distribution shifts. AMX includes a runtime guardrail
(`amx/agents/_mode_guardrail.py`) that warns when the observed
distribution looks inverted relative to the mode:

| Mode | Expected mean SC | Guardrail warns when |
|---|---|---|
| `semantic` | High & clustered (alternatives are paraphrases of the same meaning) | mean SC drops below `0.65` — likely the LLM produced meaning-shifted alternates despite the paraphrase directive |
| `lexical` | Moderate / spread (alternatives carry candidate meanings) | mean SC climbs above `0.85` — likely the LLM collapsed into paraphrases despite the lexical directive |

The guardrail logs a structured warning
(`alternatives_mode_inversion_suspect`) per affected asset. It does
not stop the run; it surfaces the asset id, the observed mean SC, and
the per-alternative scores so a reviewer can drill in.

## Where signals show up

### CLI

The `/run` progress output prints a summary line per stage:

```text
✓ table: orders                Confidence: high 24 · med 9 · low 3
```

In the interactive review wizard, every row carries the band glyph
(✓ for HIGH, ◐ for MED, ◇ for LOW) and the alternative pills carry
their per-alternative band:

```text
Latitude   ✓ high   accepted   logprob 1.000   SC: HIGH 0.79
  A · Geographic latitude coordinate that specifies the …   SC: HIGH 0.79
  B · North-south angular coordinate defining the geographic …   SC: HIGH 0.78
  C · Decimal latitude value indicating the north-south …   SC: HIGH 0.76
```

The `/history show <run>` dump includes the score columns
(`confidence`, `logprob_score`, `alternatives_json`).

### Studio

* **Run detail** — the column card shows the chosen alternative's
  band as a pill, the raw logprob, and the
  [`alternatives_mode`](alternatives-mode.md) chip. Each alternative
  in the carousel carries its own per-alternative score pill
  (`SC: HIGH 0.79`).
* **Run compare** — every cell stacks `DESCRIPTION_1..N` with one
  badge per alternative, so you can compare two runs' scores
  side-by-side. The column header carries the run's
  `alternatives_mode` chip.
* **Pending** — the review queue shows the band on every row so you
  can pick what to apply without leaving the page.

## How to pick the active signal

The signal lives on the LLM profile alongside `n_alternatives` and
`alternatives_mode`. Default for new profiles is `self_consistency`.

### CLI

```bash
amx
> /llm
> /confidence-signal                    # show current
> /confidence-signal logprob            # switch
> /confidence-signal none               # disable scoring
```

The change persists in `~/.amx/config.yml` under the active LLM
profile and applies to every subsequent `/run`.

### Studio

Settings → **LLM** → click the profile → **Confidence signal**
dropdown. Five options: `self_consistency`, `logprob`, `self_decl`,
`judge`, `none`. Save persists the change.

### Per-run override

Studio's RunNew form includes a **Confidence signal** override row
under Advanced LLM settings. The CLI does not yet expose a per-run
flag; change the profile setting with `/confidence-signal`, run,
switch back if needed.

## A reader's checklist

You're not expected to know how the scorers work to interpret the
output. The mental model is:

1. **HIGH on every alternative + tight pack** → confident parse;
   pick whichever DESCRIPTION_1 reads best.
2. **HIGH on one, LOW on the rest** → that one alternative is the
   clear winner.
3. **All MED, similar scores** → the LLM thinks they're all
   plausible. Pick by hand or rerun with more context.
4. **All LOW** → the column is hard. Either provide a document
   profile, a code profile, or a more descriptive column name and
   rerun.

## Where to next

* [config.yml reference](../configuration/config-yml.md) — the LLM
  profile schema with every confidence-related field.
* [Alternatives mode](alternatives-mode.md) — the diversity dimension
  that shapes what the SC band actually means in a given run.
* [Run & Apply](../cli/run-and-apply.md) — how the bands surface in
  the review wizard and on `--apply`.
