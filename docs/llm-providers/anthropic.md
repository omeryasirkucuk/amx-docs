# Anthropic

Configure Anthropic as the LLM provider for AMX's three sub-agents (Profile, RAG, Code).
Claude is particularly strong at following structured-output instructions, which
translates into cleaner column descriptions on schemas with awkward column names. This
page walks through registering an Anthropic profile, picking a Claude model, choosing
the right confidence thresholds for Claude's logprob-equivalent outputs, and confirming
the profile is reachable.

## Prerequisites

- AMX installed (`pip install amx-cli`).
- An Anthropic API key. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys).
- A funded Anthropic account or enough free credit. AMX surfaces 429 / quota errors clearly but it cannot mint credits for you.
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

Pick `anthropic`:

```text
Select AI provider:
  openai
  openrouter
  anthropic
  ...
> anthropic
```

### 3. Answer the model + key prompts

```text
Model: use the provider's natural model id. AMX will add any required provider prefix internally.
Anthropic model example: claude-sonnet-4-20250514
Model name: claude-sonnet-4-20250514
API key: ••••••••••••••••••••••••••••••••
Generation settings:
  Alternatives (1-5): 3
  Column batch size: 10
  Temperature (0.0-2.0): 0.2
Confidence thresholds (token probability 0.0-1.0):
  High threshold: 0.85
  Medium threshold: 0.50
```

Notes on each field:

- **Model name** — type the bare Claude model id. AMX normalises internally.
- **API key** — `sk-ant-…`. Stored in the OS keychain when one is available.
- **Alternatives / Batch size / Temperature** — same defaults as OpenAI work fine; bump `column_batch_size` to 12–15 if you want to push Claude's longer-context strength.
- **Logprob thresholds** — Claude doesn't return raw logprobs the way OpenAI does. AMX derives an equivalent from the model's stop-reason confidence and per-token sampling distribution. The default `0.85 / 0.50` is calibrated for `claude-sonnet-4`; relax for older Sonnet / Haiku models.

!!! tip "Which Claude model should I pick?"
    - **`claude-sonnet-4-20250514`** (default) — best quality / cost balance for AMX. Starts here.
    - **`claude-opus-4-…`** — highest quality for ambiguous schemas (legacy systems, transliterated column names). Slower and more expensive; use only after you've confirmed `sonnet-4` isn't enough.
    - **`claude-haiku-3-5-…`** — lowest cost. Fine for whole-warehouse `metadata`-mode sweeps where you just need first-draft descriptions.
    - **Older models (`claude-3-5-sonnet`, `claude-3-opus`)** — supported but produce lower-quality descriptions on AMX's prompt template. Upgrade.

### 4. Activate and confirm

```text
> /use-llm anthropic-prod
✓ Active LLM profile → anthropic-prod [anthropic] claude-sonnet-4-20250514

> /llm test
[anthropic] claude-sonnet-4-20250514 ... ✓ reached (latency: 821 ms, tokens: 14 in / 6 out)
```

### 5. (Optional) Enable extended thinking for hard schemas

For very ambiguous schemas (cryptic abbreviations, non-English column names), Claude's
extended-thinking modes can substantially improve description quality at the cost of
latency. Edit `~/.amx/config.yml` and add `thinking_budget_tokens` under the profile:

```yaml
llm_profiles:
  anthropic-deep:
    provider: anthropic
    model: claude-sonnet-4-20250514
    api_key: keyring://amx/anthropic-deep/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 8           # smaller batches when thinking is on
    thinking_budget_tokens: 4000   # thinking budget per request
```

Per-column cost roughly doubles, but on legacy schemas that's often the difference
between a usable draft and one you'd rewrite from scratch.

### 6. Run a real description sweep

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     anthropic/claude-sonnet-4-20250514, batch 10, 18 columns ... ok in 5.8 s
          confidence: high 11 · medium 5 · low 2
```

## Sample config

```yaml
llm_profiles:
  anthropic-prod:
    provider: anthropic
    model: claude-sonnet-4-20250514
    api_key: keyring://amx/anthropic-prod/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 10
    logprob_high: 0.85
    logprob_medium: 0.50
active_llm_profile: anthropic-prod
```

## Verify

1. `> /llm test` — small ping completion. Surfaces auth / quota errors before a real `/run`.
2. `> /llm` — confirms the active profile and model id.
3. `> amx doctor` — confirms reachability and that the model id resolves.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `anthropic.AuthenticationError: invalid x-api-key` | Key revoked / typo | Re-issue at [console.anthropic.com](https://console.anthropic.com/settings/keys); re-run `/add-llm-profile` |
| `anthropic.RateLimitError: Number of requests exceeded …` | Per-minute request cap (Tier 1: 50 RPM) | Lower `column_batch_size` so each request is a bigger payload, OR upgrade tier |
| `anthropic.NotFoundError: model: claude-3-opus-20240229 not found` | Model id deprecated for your account | Use `claude-sonnet-4-20250514` (current default); confirm the available models in the Console |
| Lots of `low` confidence on otherwise simple columns | Default thresholds calibrated for `sonnet-4`; older Sonnet / Haiku gives lower derived confidence | `/logprob-thresholds 0.7 0.4` for older models |
| `anthropic.BadRequestError: max_tokens: …` mid-`/run` | Column batch + thinking budget exceeded the model's context window | Lower `column_batch_size` or `thinking_budget_tokens` |
| Cost surprise | Sonnet ≈ 3× Haiku per token; with `n_alternatives: 3` you're paying for three drafts per column | Drop to `claude-haiku-3-5-…` for sweeps, or use [Batch mode](batch-mode.md) for ~50% off |

## What's next

- [Batch mode](batch-mode.md) — Anthropic's batch API for cheap async drafts (~50% off, 24h SLA).
- [OpenAI](openai.md) — same template; useful as a parallel profile for `/history compare`.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes for picking between Claude's alternatives.
