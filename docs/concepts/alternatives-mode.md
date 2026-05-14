# Alternatives diversity mode

When AMX asks the LLM for `n_alternatives` candidate descriptions per
column, the **diversity mode** controls *what kind of variation* shows
up across `DESCRIPTION_1..N`. The user picks the dimension that matters
for their workflow:

* **`semantic`** — alternatives preserve the meaning of `DESCRIPTION_1`
  and vary the surface form. Synonyms, restructured phrasing,
  alternative word choices. **No** new concepts, attributes, or
  nuances are introduced. Use when you want clean paraphrases of the
  same idea — different ways to say the same thing.
* **`lexical`** — alternatives preserve surface-level vocabulary
  overlap (shared key tokens, similar phrasing) and allow the meaning
  to **drift**. Added qualifiers ("sequential", "internal",
  "primary"), reframed referents ("record" → "physical place"),
  narrower / broader scope. Use when you want candidate
  interpretations of the same column.

The literal mode names match the field on disk (`config.yml`) and the
column on `run_results.alternatives_mode`, so the wording in the UI,
the CLI, the YAML, and the audit trail are all the same word.

!!! note "Definition 1 (NLP standard)"
    AMX follows the standard NLP definition of *semantic* vs *lexical*
    similarity: semantic = same meaning / different words; lexical =
    shared vocabulary / shifted meaning. Older copies of this site
    used the labels in the opposite direction; if you are reading
    archived material that contradicts the worked examples below,
    trust the worked examples.

## Semantic mode — worked example

**Source description** (`DESCRIPTION_1`):

> Unique identifier for a geographic location record.

**Two semantic alternatives** the model is steered toward:

> 1. Distinct numeric key assigned to every individual geographic
>    location.
> 2. Primary identifier that distinguishes each geographic location
>    entry.

Every alternative carries the same facts: "unique" / "identifier" /
"geographic location record". Only the surface — verb choice, noun
phrase shape, sentence structure — varies.

## Lexical mode — worked example

**Source description** (`DESCRIPTION_1`):

> Unique identifier for a geographic location record.

**Two lexical alternatives** the model is steered toward:

> 1. Sequential numeric key assigned to each distinct geolocation
>    entry. *(adds the new attribute "sequential" — a meaning shift)*
> 2. Internal reference number for a physical place or mapped point.
>    *(reframes the referent: "record" → "physical place / mapped
>    point")*

Each alternative re-uses the source's key tokens ("identifier" / "key"
/ "geographic" / "location") and adds **one new conceptual nuance**
that shifts what the description actually claims. A reviewer can
articulate the difference in a single sentence per alternative.

## Choosing between modes

| You want… | Pick |
|---|---|
| Multiple ways to **say the same thing**, e.g. when you've decided on the column's meaning and want to pick the wording that reads best in your catalog. | `semantic` |
| Multiple **candidate meanings** to vote on, e.g. when you're unsure whether a column is "primary identifier", "sequential surrogate key", or "internal reference number". | `lexical` |
| To see the field as a single answer — no carousel, no badge. Set `n_alternatives: 1` and the mode field becomes irrelevant. | (mode unused) |

## Set the default on an LLM profile

The mode lives on the LLM profile, alongside `n_alternatives` and
`confidence_signal`. The default for new profiles is `semantic`.

### CLI

```bash
amx
> /llm                                # enter the /llm namespace
> /alternatives-mode                  # show current setting
> /alternatives-mode lexical          # switch to lexical
> /alternatives-mode semantic         # switch back
```

The change is written to `~/.amx/config.yml` and applies to every
`/run` from this profile onward. You can also edit the file directly:

```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  n_alternatives: 3
  alternatives_mode: semantic         # or: lexical
  confidence_signal: self_consistency
```

### Studio

Settings → **LLM** → click the profile → **Alternatives diversity
mode** tile group. Two tiles, click to select; the change persists on
Save. The tile is disabled when `Alternatives per column` is 1 (mode
has no effect on a single-answer profile).

## Override per run

The mode can be overridden for a single run without mutating the saved
profile.

### Studio

RunNew → expand **Advanced LLM settings** → the **Alternatives
diversity mode** override row. Pick `semantic` or `lexical` — the
header tag of the resulting run carries the chosen mode.

### CLI

The CLI does not yet expose a per-run flag for `alternatives_mode`.
The pattern matches the rest of the LLM-profile knobs (`n_alternatives`,
`confidence_signal` etc. are also profile-level only on the CLI):
change the profile setting with `/alternatives-mode`, run, then
switch back if needed.

## How the mode surfaces in results

Every result row carries the mode it was generated under in
`run_results.alternatives_mode`. Studio surfaces this as a small
`[Semantic]` or `[Lexical]` chip:

* **Run detail page** — beside the confidence + logprob row on each
  `ColumnSuggestionCard`.
* **Run compare page** — once per run, beside the run id in the
  column header. Lets you tell at a glance which run used which mode
  when comparing.

The CLI's `/history show <run>` includes the mode in the row dump.

## Where to next

* [config.yml reference](../configuration/config-yml.md) —
  full field-level reference for the LLM profile schema, including
  `alternatives_mode` and the surrounding knobs.
* [Confidence signals](confidence-signals.md) — how the per-alternative
  HIGH / MED / LOW band is computed; the mode you pick changes what
  the bands should look like.
* [Run & Apply](../cli/run-and-apply.md) — the `/run` command that
  generates the alternatives.
