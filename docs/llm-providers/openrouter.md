# OpenRouter

OpenRouter is a routing layer in front of dozens of LLM providers. One
key, one billing relationship, and you can switch between OpenAI,
Anthropic, Google, Mistral, DeepSeek, Moonshot, Qwen, Llama, and others
just by changing the model identifier.

In AMX, OpenRouter is its own provider key: `openrouter`. The model
field carries the provider/model pair OpenRouter expects, e.g.
`openai/gpt-4o`, `anthropic/claude-sonnet-4`, `moonshotai/kimi-k2`.

## Prerequisites

- An OpenRouter account and key — sign up at
  [openrouter.ai](https://openrouter.ai/) and create a key under
  **Keys**. The key starts with `sk-or-…`.
- AMX installed (`pip install amx-cli`).

## `/add-llm-profile` walkthrough

```text
> /add-llm-profile
Profile name: or-claude
Provider:     openrouter
Model:        anthropic/claude-sonnet-4
API key:      sk-or-…                           # paste from the dashboard
Temperature:  0.2
Output token budget (max_tokens) [4096]:        # press Enter
Number of alternatives per column [3]:          # press Enter
✓ Saved LLM profile 'or-claude' to ~/.amx/config.yml
```

### Sample config block

```yaml
llm_profiles:
  or-claude:
    provider: openrouter
    model: anthropic/claude-sonnet-4
    api_key: keyring://amx/or-claude/api_key
    temperature: 0.2
    n_alternatives: 3
active_llm_profile: or-claude
```

Setting `OPENROUTER_API_KEY` in the environment is equivalent to the
YAML field — useful for CI.

## Model selection

OpenRouter's catalogue is huge. A few common picks:

| Model id | Why |
|---|---|
| `openai/gpt-4o` | Same as the OpenAI provider, but routed through OpenRouter |
| `anthropic/claude-sonnet-4` | Same as the Anthropic provider |
| `moonshotai/kimi-k2-thinking` | Extended-thinking reasoning route (Kimi K2.x) |
| `deepseek/deepseek-r1` | Reasoning route via DeepSeek |
| `qwen/qwen3-thinking` | Open-weights reasoning route |
| `meta-llama/llama-3.1-70b-instruct` | Open-weights chat |

Browse the full list at
[openrouter.ai/models](https://openrouter.ai/models).

## Reasoning routes

OpenRouter exposes many "thinking" / reasoning variants. AMX detects
them via the model id and applies the same 32 768-token floor plus
4× retry budget it uses for direct reasoning providers. AMX sends
`reasoning.effort` only — never `reasoning.max_tokens` — because
OpenRouter rejects the combination.

The default `AMX_REASONING_EFFORT` for OpenRouter is `low` so token
burn stays bounded by default. Override with the env var when you
want richer thinking on a hard subset:

```bash
export AMX_REASONING_EFFORT=medium
```

## Cost notes

OpenRouter charges a small markup over the upstream provider's
list price. The trade-off:

- **Pro** — one key, one bill, one set of usage logs across many
  providers; the cheapest way to A/B Anthropic vs OpenAI on the same
  workload
- **Con** — every request adds ~10 ms of routing latency; usage
  reports separate "AMX did X" from "OpenAI billed Y" by one extra
  hop

Pricing for every routed model lives in
[Studio → Pricing](../studio/pricing.md).

## Logprobs

Logprob support varies per upstream route. OpenAI routes return them;
some Anthropic routes derive them; thinking variants frequently don't.
When logprobs are absent, AMX falls back to model-declared confidence
buckets.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Unauthorized` | Re-check `OPENROUTER_API_KEY`. Keys start with `sk-or-` |
| `404 model not found` | Model id is case-sensitive and uses `provider/model` form. Check the [models page](https://openrouter.ai/models) |
| `400 reasoning.max_tokens not allowed` | An older AMX version. Upgrade — `0.12.0+` only sends `reasoning.effort` |
| Reasoning route returns 0 visible characters | Bump `AMX_LLM_MIN_MAX_TOKENS`, or raise `AMX_REASONING_EFFORT` to `minimal` to bias the model toward shorter thinking |
| `429 rate limited` | OpenRouter applies per-key QPS limits. Lower `column_batch_size` |
