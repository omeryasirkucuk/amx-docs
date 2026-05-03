# Google Gemini

Configure Google Gemini as the LLM provider for AMX's three sub-agents (Profile, RAG,
Code). Gemini is competitive on cost — `gemini-2.0-flash` is one of the cheapest
production-grade chat models — and it has very large context windows that let AMX pack
big column batches into single prompts. This page walks through registering a Gemini
profile, picking a model, navigating Gemini's safety filters, and confirming the profile
is reachable.

## Prerequisites

- AMX installed (`pip install amx`).
- A Google AI Studio API key. Get one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- A funded Google Cloud account (for Vertex AI quota beyond the free Gemini API tier) OR enough free-tier requests for prototyping.
- An active database profile (or follow [Quick start](../getting-started/quickstart.md) first).

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add an LLM profile

```text
> /add-llm-profile
```

Pick `gemini`:

```text
Select AI provider:
  openai
  openrouter
  anthropic
  gemini
  ...
> gemini
```

### 3. Answer the model + key prompts

```text
Model: use the provider's natural model id. AMX will add any required provider prefix internally.
Gemini model example: gemini-2.0-flash
Model name: gemini-2.0-flash
API key: ••••••••••••••••••••••••••••••••
Generation settings:
  Alternatives (1-5): 3
  Column batch size: 15
  Temperature (0.0-2.0): 0.2
Confidence thresholds (token probability 0.0-1.0):
  High threshold: 0.85
  Medium threshold: 0.50
```

Notes on each field:

- **Model name** — type the bare Gemini model id (no `google/` prefix; AMX adds the provider routing internally).
- **API key** — `AIza…`. Stored in the OS keychain when one is available.
- **Column batch size** — bump to `15` for Gemini. Its 1M-token context window means you can pack more columns per prompt without quality loss; this is the easiest way to make Gemini cheap-per-column.
- **Logprob thresholds** — Gemini exposes per-token logprobs for AMX to bucket confidence; defaults `0.85 / 0.50` work for `gemini-2.0-flash`.

!!! tip "Which Gemini model should I pick?"
    - **`gemini-2.0-flash`** (default) — the workhorse. Cheap, fast, very good for description drafting.
    - **`gemini-2.0-pro`** — slower / more expensive but stronger on cryptic legacy schemas.
    - **`gemini-1.5-pro`** / **`gemini-1.5-flash`** — legacy. Stick to 2.0 unless your account is pinned to a project that doesn't have 2.0 access yet.

### 4. Activate and confirm

```text
> /use-llm gemini-prod
✓ Active LLM profile → gemini-prod [gemini] gemini-2.0-flash

> /llm test
[gemini] gemini-2.0-flash ... ✓ reached (latency: 487 ms, tokens: 13 in / 7 out)
```

### 5. Run a real description sweep

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     gemini/gemini-2.0-flash, batch 15, 18 columns ... ok in 3.4 s
          confidence: high 14 · medium 3 · low 1
```

## Sample config

```yaml
llm_profiles:
  gemini-prod:
    provider: gemini
    model: gemini-2.0-flash
    api_key: keyring://amx/gemini-prod/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 15
    logprob_high: 0.85
    logprob_medium: 0.50
active_llm_profile: gemini-prod
```

## Verify

1. `> /llm test` — small ping completion. Surfaces auth / quota / safety-filter issues before a real run.
2. `> /llm` — confirms the active profile and model id.
3. `> amx doctor` — confirms reachability and that the model id resolves.

## Safety filters — what to expect

Gemini applies safety filters to every response. For schema-description drafting they
almost never trigger, but the cases that *do* trigger are surfacing user-data values from
profiling samples that look like prompt-injection attempts or unsafe content (e.g. a
`comments` column full of customer-uploaded text).

When a filter triggers, AMX's `/run` output shows:

```text
[LLM]     gemini/gemini-2.0-flash ... 1 column blocked by safety filter
          → notes (HARM_CATEGORY_HARASSMENT, BLOCK_MEDIUM_AND_ABOVE)
          retrying with sample suppressed ...
          ✓ recovered (high: 14 · medium: 3 · low: 1)
```

AMX automatically retries the blocked column with the offending sample value scrubbed —
the column still gets a description, just one drafted without that sample row. If the
retry still fails, the column lands in `low` confidence so you review it manually.

To pre-empt the issue on a known-noisy column, add it to the profile-skip list (see
[Profiling modes](../configuration/profiling-modes.md) for `profiling_skip_columns`).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `google.api_core.exceptions.PermissionDenied: 403 API key not valid` | Key expired / project disabled | Issue a new key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generative Language API'` | Free-tier RPM cap (60 RPM) | Lower `column_batch_size` to 8–10 OR upgrade to a paid tier |
| `400 INVALID_ARGUMENT: User location is not supported for the API use without a billing account.` | Free tier blocked in your region | Attach billing to the Google Cloud project, or use Vertex AI via a service-account JSON instead |
| Many columns blocked by safety filters | Profiling samples include user-generated text | Add the offending column to `profiling_skip_columns` so its samples never reach the LLM |
| `400 INVALID_ARGUMENT: Request contains an invalid argument.` | Mixing `column_batch_size: 30+` with `n_alternatives: 5` exceeds the per-request token limit | Lower one or the other; Gemini is forgiving but not unlimited |

## What's next

- [Batch mode](batch-mode.md) — Gemini's batch API isn't supported in AMX yet; OpenAI / Anthropic batch is.
- [OpenAI](openai.md) — same template; useful as a parallel profile for `/history compare`.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes for picking between alternatives.
