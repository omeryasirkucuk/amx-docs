# Kimi

Kimi (Moonshot) is a Chinese provider whose K2.x line targets extended
thinking workloads. AMX recognises the `kimi` provider key and routes
calls through Moonshot's OpenAI-compatible HTTPS endpoint.

The same models are also reachable via [OpenRouter](openrouter.md);
pick `kimi` when you want a direct relationship with Moonshot, pick
OpenRouter when you'd rather use one routing key across providers.

## Prerequisites

- A Moonshot platform account and API key. Sign up at
  [platform.moonshot.ai](https://platform.moonshot.ai/) and create a
  key under **API Keys**.
- AMX installed (`pip install amx-cli`).

## `/add-llm-profile` walkthrough

```text
> /add-llm-profile
Profile name: kimi-thinking
Provider:     kimi
Model:        kimi-k2-thinking
API base:     https://api.moonshot.cn/v1
API key:      sk-…                              # paste from the dashboard
Temperature:  0.2
Output token budget (max_tokens) [4096]:        # press Enter
Number of alternatives per column [3]:          # press Enter
✓ Saved LLM profile 'kimi-thinking' to ~/.amx/config.yml
```

### Sample config block

```yaml
llm_profiles:
  kimi-thinking:
    provider: kimi
    model: kimi-k2-thinking
    api_base: https://api.moonshot.cn/v1
    api_key: keyring://amx/kimi-thinking/api_key
    temperature: 0.2
    n_alternatives: 3
active_llm_profile: kimi-thinking
```

`kimi` is routed through an OpenAI-compatible endpoint, so the wizard
prompts for an `api_base`. Moonshot publishes its endpoint as
`https://api.moonshot.cn/v1`. The provider key uses `AMX_LLM_API_KEY`
as a fallback when the YAML `api_key` field is blank — there is no
provider-specific env var equivalent to `OPENAI_API_KEY`.

## Model selection

| Model | When to pick it |
|---|---|
| `moonshot-v1-8k` | Lightweight chat, 8 K context, low cost |
| `moonshot-v1-32k` | Same, larger context — useful on very wide tables |
| `moonshot-v1-128k` | 128 K context — when both the schema and the doc/code RAG payload are large |
| `kimi-k2-thinking` | Extended-thinking reasoning route. Strong on cryptic schemas |
| `kimi-k2-instruct` | Instruction-tuned chat variant of K2 |

K2.x reasoning variants ("`-thinking`" suffix) are reasoning routes —
AMX applies the 32 768-token output floor, the 4× retry budget on
`finish_reason=length`, and passes `reasoning.effort` (default `low`,
bumpable via `AMX_REASONING_EFFORT`).

## Cost notes

K2.x reasoning routes are noticeably cheaper than `gpt-5` or
`claude-opus-4` for comparable reasoning workloads, but the
per-request latency is higher (the model is doing more thinking).
Use it for cryptic legacy schemas on a hard subset, not as the bulk
drafting workhorse.

Live rates surface in [Studio → Pricing](../studio/pricing.md).

## Logprobs

K2.x reasoning routes do not return logprobs at this time. AMX falls
back to model-declared confidence buckets — `high` / `medium` / `low`
are still surfaced, they just come from a different signal than the
calibrated logprob threshold.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Unauthorized` | Re-check the API key. Moonshot keys start with `sk-` |
| `429 rate limited` | New accounts have low QPS caps. Lower `column_batch_size` or contact Moonshot for a higher quota tier |
| Reasoning route returns 0 visible characters | The 32 768 floor wasn't enough. `export AMX_LLM_MIN_MAX_TOKENS=65536` |
| Very slow first response | K2.x thinking models are intrinsically slower. Raise `AMX_LLM_TIMEOUT_SEC` if AMX bails out before the answer arrives |

## What's next

- [OpenRouter](openrouter.md) — same models behind one routing key.
- [Anthropic — extended thinking](anthropic.md) — Claude's equivalent
  reasoning route.
- [LLM Providers overview](index.md) — pick a direct provider vs a
  routing layer.
