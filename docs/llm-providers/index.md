# LLM providers

AMX talks to LLMs through a single unified interface based on
[LiteLLM](https://docs.litellm.ai/), with extensions for batch APIs, logprob collection,
and reasoning-token budget management.

## Supported providers

| Provider | Config value | Notes |
|---|---|---|
| OpenAI | `openai` | Direct API. Reasoning routes (`o-series`, `gpt-5`) get an auto-raised token floor. |
| OpenRouter | `openrouter` | Use `provider/model` format like `openai/gpt-4o-mini` or `anthropic/claude-3.5-sonnet` |
| Anthropic | `anthropic` | Direct API. Extended-thinking routes get the reasoning floor. |
| Google Gemini | `gemini` | |
| DeepSeek | `deepseek` | OpenAI-compatible — see notes below. |
| Ollama | `ollama` | Local. Base URL `http://localhost:11434` (no `/v1`). |
| OpenAI-compatible | `local` | Generic. Base URL `http://localhost:11434/v1` for vLLM / LM Studio / Ollama-OpenAI mode. |

## Adding an LLM profile

```text
amx
/add-llm-profile openai_main
```

Or via the wizard during `/setup`. The fields are:

- **Provider** — one of the values above.
- **Model id** — provider-specific. For OpenRouter, use the `provider/model` format.
- **API key** — stored in the OS keychain when available; the YAML keeps a reference.
- **Base URL** — only for `local` and self-hosted endpoints.
- **Sampling temperature** — defaults to `0.2`, clamped to `[0.0, 2.0]`.

Switch the active profile with `/use-llm <name>`. List profiles with `/llm-profiles`.

## Per-provider pages

- [OpenAI](openai.md) — direct + reasoning-route handling
- [Anthropic](anthropic.md) — direct + extended thinking + Anthropic Batch
- [Gemini](gemini.md)
- [Ollama / OpenAI-compatible local endpoints](ollama-local.md)
- [Batch mode](batch-mode.md) — OpenAI Batch + Anthropic Message Batches

## Cost controls

AMX exposes the cost knobs explicitly so you don't have to guess what's happening:

- `/usage [window]` — token + approximate cost summary read from `~/.amx/history.db`
  (no network calls).
- `/llm-batch-size N` — columns per Profile-Agent LLM call. Larger = fewer round trips.
- `/n-alternatives 1..5` — alternatives per column. Default 3, drop to 1 for cheap runs.
- `/prompt-detail minimal|standard|detailed|full` — preset prompt budget. Run without
  args to see the comparison table.
- `/temperature 0.0..2.0` — lower = less variance = cheaper retries. Default `0.2`.
- `/run --batch` — when supported, route the run through the provider's Batch API for
  ~50% cost reduction at the price of latency.

Pricing is built in for OpenAI / Anthropic / Gemini / DeepSeek so `/usage` shows real
dollar amounts. Unknown models show `—` for cost.

## Reasoning models

Non-streamed calls to reasoning routes (kimi-k2-thinking, deepseek-reasoner,
claude-sonnet-4 / opus-4 / 3.7-sonnet, and any o-series / gpt-5 route) used to keep the
regular `max_tokens=4096` budget, so agents in CHAT mode (Profile, Code, RAG) routinely
failed with `finish_reason=length` — the model burned the whole budget on internal
thinking.

AMX now auto-raises the floor whenever a model is recognised as a reasoning route:
default `AMX_LLM_MIN_MAX_TOKENS=16384`. This applies across providers (OpenAI direct,
OpenRouter, Anthropic) so the same agent code works for every reasoning-capable route.

For OpenRouter specifically, AMX sends `reasoning.effort` only — never `reasoning.max_tokens`
together with it — because the OpenRouter API rejects that combination. The default
effort drops from `medium` → `low` so token burn stays bounded; set
`AMX_REASONING_EFFORT=high` to override.

## Logprobs and confidence

AMX requests logprobs by default (`force_logprobs: true` in the LLM profile). The orchestrator
uses them to calibrate confidence bands — see [Agents](../concepts/agents.md#confidence-and-logprobs).

When provider token offsets can be reconstructed, AMX scores generated description text
per suggestion. Otherwise it falls back to a whole-response score. OpenAI Batch returns
logprobs; **Anthropic Batch does not**, so those batch results keep model-declared
confidence labels until merged by a logprob-capable chat call.

## Failure semantics

- `/analyze /run` tests the active LLM **before** profiling any asset and stops if the
  model/profile is unreachable or deactivated.
- When `finish_reason=length`, AMX halts processing. Truncated JSON is **never** parsed
  silently — the run reports the truncation and you decide whether to raise the budget.
- Third-party LiteLLM warnings / debug lines are suppressed by default; AMX surfaces only
  its own actionable warnings.

## Provider-prefix typo normalisation

AMX normalises common provider-prefix typos in model ids so a stray keystroke doesn't
silently route to the wrong provider:

- `oepnai/gpt-4o-mini` → corrected to OpenAI namespace.
- Similar normalisations for `antropic/`, `googel/`, `gemeni/`, etc.

The original typo and the corrected value are both logged.
