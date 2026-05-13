# DeepSeek

DeepSeek is the lowest-cost option among hosted providers AMX supports.
The default chat model (`deepseek-chat`) is well-suited to bulk drafting,
and the reasoning route (`deepseek-reasoner`) is a strong fit for
cryptic legacy schemas where extended thinking helps.

DeepSeek runs through its native OpenAI-compatible API.

## Prerequisites

- A DeepSeek account and API key — sign up at the
  [DeepSeek platform](https://platform.deepseek.com/) and create a key
  under **API Keys**.
- AMX installed (`pip install amx-cli`).

## `/add-llm-profile` walkthrough

```text
> /add-llm-profile
Profile name: deepseek-prod
Provider:     deepseek
Model:        deepseek-chat
API key:      sk-…                              # paste from the dashboard
Temperature:  0.2
Output token budget (max_tokens) [4096]:        # press Enter
Number of alternatives per column [3]:          # press Enter
Logprob thresholds  high [0.85]:                # press Enter
                    medium [0.50]:              # press Enter
✓ Saved LLM profile 'deepseek-prod' to ~/.amx/config.yml
```

### Sample config block

```yaml
llm_profiles:
  deepseek-prod:
    provider: deepseek
    model: deepseek-chat
    api_key: keyring://amx/deepseek-prod/api_key
    temperature: 0.2
    n_alternatives: 3
    logprob_high: 0.85
    logprob_medium: 0.50
active_llm_profile: deepseek-prod
```

You can also set the API key via the `DEEPSEEK_API_KEY` env var and
leave `api_key: ""` in the YAML — useful for CI.

## Model selection

| Model | When to pick it |
|---|---|
| `deepseek-chat` | Default. General-purpose drafting, very low cost |
| `deepseek-reasoner` | Extended-thinking variant. Useful on cryptic / transliterated schemas where standard models hallucinate. Slower and more expensive |

`deepseek-reasoner` is a reasoning route — AMX automatically applies
the 32 768-token output floor and a 4× retry budget on
`finish_reason=length`. See
[Reasoning models](index.md#reasoning-models).

## Cost notes

`deepseek-chat` is roughly $0.27 / Mtok input and $1.10 / Mtok output
at the time of writing — about 5× cheaper than `gpt-4o`. The Studio
[Pricing](../studio/pricing.md) browser shows live rates.

## Logprobs

DeepSeek returns native logprobs on `deepseek-chat`. The reasoning
route's logprob support varies — fall back to the model-declared
confidence if `logprob_high` / `logprob_medium` flags fire empty.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Unauthorized` on first call | Re-check `DEEPSEEK_API_KEY` or the YAML `api_key:` field. Keys start with `sk-`, like OpenAI |
| Reasoning route returns 0 visible characters | The 32 768 floor wasn't enough — `export AMX_LLM_MIN_MAX_TOKENS=65536` and retry |
| Rate-limit (429) on a bulk run | Lower `column_batch_size` or the new account's QPS cap — DeepSeek throttles aggressively on free-tier keys |

## What's next

- [Configuration: env vars → `DEEPSEEK_API_KEY`](../configuration/env-vars.md#llm-provider-keys)
- [Run & Apply](../cli/run-and-apply.md) — what happens after this
  profile is active.
- [LLM Providers overview](index.md) — pick a different model for a
  specific job.
