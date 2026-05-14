# Variations

The **Variations** flow lets you ask the LLM for fresh alternatives
*anchored* on one specific description you've already seen. Where
[Re-Run](run-detail.md#rerun) regenerates an asset's alternatives
from scratch, Variations seeds the prompt with the alternative you
liked and asks the model to vary around it.

## When to use it

- You like alternative *B* of a column but want the same idea phrased
  three different ways before applying.
- You're not sure which of two competing readings is right; you pick
  one as the seed and let Variations propose neighbouring candidate
  meanings under `lexical` mode.
- You want to compare wordings for `geolocation`-style ambiguous
  columns without re-running the whole asset (which would discard the
  alternatives you'd already seen).

## Where it lives

On any run detail page, every alternative inside the **Results** tab
carries a small ✨ trigger next to its confidence badge. The trigger
appears only when the row has at least two alternatives — a
single-answer row has nothing to vary around.

Click ✨ → the Variations modal opens with:

1. **Seed Alternative** — the chosen alt's letter pill (e.g. `B`)
   and verbatim text, read-only. This is the source you're varying
   around.
2. **Variation type** — top-level radio: `Semantic` (paraphrase the
   seed) or `Lexical` (share vocabulary with the seed, allow meaning
   to drift). Pre-selected to the parent run's mode so a follow-up
   Variations stays in the same exploration.
3. **Additional instructions** — optional free-text addendum
   appended to the seed directive ("Emphasize the temporal
   dimension.").
4. **Advanced LLM settings** — collapsible disclosure that mounts the
   shared *Advanced LLM settings* block (LLM profile selector +
   every Generation knob, Confidence thresholds, Cost overrides). The
   `Alternatives diversity mode` row is hidden here because mode is
   set at the top-level radio above.

Submit → the modal closes and a worker thread fires; the SSE stream
posts the new alternatives to the page. The new `run_results` row
carries the audit columns `seed_alternative_id`,
`seed_alternative_text`, `parent_run_id`, `model`, and `provider`
so the audit trail captures both the seed lineage *and* the
per-row LLM identity (important when a per-run model override
was applied).

## Per-run model selector

The same Advanced LLM settings block exposes an **LLM profile**
row at the top of the Generation section. Pick a different saved
profile to swap the whole `provider` / `model` / `api_key` /
`api_base` bundle for this single run — useful when you want to run
one Variations against `gpt-5.5` once without editing your saved
profile. Per-knob overrides (temperature, max tokens, …) layer on
top of the picked profile. Saved profiles on disk are never
mutated.

When the picked profile has `has_credentials: false` (no API key in
the keyring) the submit button disables with an inline warning
pointing at Settings → LLM → that profile to add a key.

## Capability gating

The Advanced LLM settings block grays out knobs the chosen
`(provider, model)` doesn't honour:

- `thinking_budget` is disabled on non-reasoning models (anything
  outside Anthropic Claude Sonnet/Opus 4+, DeepSeek-reasoner,
  OpenAI o-series, OpenRouter reasoning routes).
- `logprob_high` / `logprob_medium` are disabled on providers that
  reject `logprobs=True` (Anthropic native, Gemini Flash, OpenAI
  o-series / GPT-5, Databricks Foundation Model Serving's Anthropic
  shim, OpenRouter Anthropic / Flash routes).

The capability table lives in `amx/llm/capabilities.py`; the
Studio fetches it from `GET /api/llm/capabilities?provider=…&model=…`
and caches the result for the whole session.

## CLI equivalent

```bash
amx
> /variations <result_id> <letter>
> /variations 12345 B
> /variations 12345 B --mode lexical
> /variations 12345 B --instructions "Emphasize the temporal dimension."
```

`<letter>` accepts both letters (`A`–`Z`) and zero-based numeric
indices (`0`, `1`, …). When `--mode` is omitted the CLI defaults to
the parent run's `alternatives_mode` so a follow-up exploration
stays consistent.

## Where variations appear on the page

Two surfaces, both backed by the same `parent_run_id` /
`seed_alternative_id` columns:

**On the parent run's detail page** — below the v1 results table,
an *Other versions* card lists every Variations / Re-Run descendant
as a collapsible group. The newest descendant is auto-expanded; older
versions stay collapsed by default so the user can fall back to v1
without scrolling. Each card header shows the version label
(`v2`, `v3`, …), the kind (`Variations` / `Re-Run`), a clickable link
to the descendant run, the seed alternative letter (Variations only),
the diversity mode, the effective LLM model, and the row count. The
group expands to show the verbatim seed text + every per-asset row
with its A/B/C alternatives. The version labels are computed
server-side on `GET /api/runs/{id}/results?include_descendants=true`
so they stay stable across reloads.

**On the descendant run's own detail page** — a lineage chip
renders directly under the status row, before the scope chip. For
Variations: `From run #N · seed: <letter> "<seed text truncated to
60 chars>"`. For Re-Run: `Re-run of run #N`. The chip is clickable
and navigates back to the parent run.

A secondary line under the tab strip on the parent run reads
`Showing N original · M variations / re-runs` so the count badge on
the Results tab (which counts only the run's direct rows) stays
unambiguous.

## What gets persisted

Every Variations run creates:

1. One new row in `analysis_runs` with `command = "rerun"` and
   `settings_json.trigger = "variations"` plus
   `settings_json.parent_run_id` pointing back at the source run.
2. One new row in `run_results` carrying the audit columns:
   - `seed_alternative_id` — `"{parent_result_id}:{alt_index}"`,
     e.g. `"12345:1"` for row 12345 alt B.
   - `seed_alternative_text` — verbatim text of the seed.
   - `parent_run_id` — the source `analysis_runs.id`.
   - `model` / `provider` — effective LLM identity that produced
     the row (captures per-run profile overrides).
   - `alternatives_mode` — `semantic` or `lexical`, mirroring the
     top-level radio.

`/history show <new_run_id>` surfaces the variation as a normal row
with the audit fields populated; the seed text is filtered out of
the alternatives list so the new row carries only the *new*
variations, not the seed itself.

## Out of scope (deliberate)

- **Multi-seed.** Combining several alternatives into a single
  composite seed is not supported — pick one alt, run Variations,
  then pick the best result.
- **Recursive Variations of Variations.** The current release
  surfaces the new run as a regular run accessible from
  `/history` and the runs list. A future release will render
  Variations inline-nested under their seed alternative directly
  on the parent run's detail page.

## See also

- [Run detail](run-detail.md) — where the ✨ trigger lives.
- [Alternatives diversity mode](../concepts/alternatives-mode.md)
  — what `semantic` vs `lexical` actually does to the prompt.
- [Confidence signals](../concepts/confidence-signals.md) — how the
  per-alternative HIGH / MED / LOW band is computed.
