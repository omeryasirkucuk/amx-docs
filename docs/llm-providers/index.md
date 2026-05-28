# LLM providers

AMX talks to LLMs through a single unified interface, so you can swap providers per
profile without touching application code or prompts. This page summarises which
providers are supported, the trade-offs between them, and where to start when picking
the right one for your workload.

## Pick a provider

Use this short decision tree before reaching for any specific page:

- **First-time AMX user, prototyping** → [OpenAI](openai.md) with `gpt-4o`. The most battle-tested provider; every prompt template and confidence threshold is calibrated against it first.
- **Cost-sensitive whole-warehouse drafting** → [Batch mode](batch-mode.md) with `gpt-4o-mini` or `claude-haiku-3-5`. ~50% off the live-API rate, async SLA.
- **Cryptic legacy schemas (transliterated names, abbreviations)** → [Anthropic](anthropic.md) with `claude-sonnet-4` or extended-thinking on a hard subset.
- **Big context windows for very wide tables** → [Gemini](gemini.md) with `gemini-2.0-flash` and `column_batch_size: 15`.
- **Already on Databricks** → [Databricks Serving](databricks-serving.md) with a Foundation Model endpoint (e.g. `databricks-meta-llama-3-1-70b-instruct`). Same workspace as your data, billed against your existing Databricks contract, no extra vendor.
- **On-prem / air-gapped** → [Ollama and local](ollama-local.md). Llama-3 / Qwen / DeepSeek work; logprob calibration is per-model.

## Provider matrix

AMX ships with **9 provider keys**: 6 hosted (OpenAI, Anthropic, Gemini,
Databricks Serving, OpenRouter, DeepSeek) and 3 keyless / self-hosted
(Ollama, local-via-LiteLLM, Kimi).

| Provider | Default model | Cost lens | Logprobs | Batch API | Key file |
|---|---|---|---|---|---|
| [OpenAI](openai.md) | `gpt-4o` | Mid (cheap with `mini`) | ✓ native | ✓ ([batch](batch-mode.md)) | `sk-…` |
| [Anthropic](anthropic.md) | `claude-sonnet-4-20250514` | Mid–High | ✓ derived | ✓ ([batch](batch-mode.md)) | `sk-ant-…` |
| [Gemini](gemini.md) | `gemini-2.0-flash` | Low | ✓ native | ✗ in AMX yet | `AIza…` |
| [Databricks Serving](databricks-serving.md) | `databricks-meta-llama-3-1-70b-instruct` | Bills against your Databricks workspace | varies (per-endpoint) | ✗ | Databricks PAT |
| [OpenRouter](openrouter.md) | `provider/model` id | Varies (small markup over upstream) | varies (per-route) | ✗ | `sk-or-…` |
| [DeepSeek](deepseek.md) | `deepseek-chat` | Very low | ✓ native | ✗ | `sk-…` |
| [Ollama / local](ollama-local.md) | `llama3` | Free (compute is yours) | varies | ✗ | optional |
| [Kimi](kimi.md) | `moonshot-v1-8k` / `kimi-k2-thinking` | Low–Mid (reasoning-heavy) | varies | ✗ | API key |

`Kimi` and `local` are routed through OpenAI-compatible HTTPS endpoints
and reuse the OpenAI client under the hood. `OpenRouter` is a routing
layer — every key it supports translates to one of the providers above.

## Generation defaults that apply across all providers

The wizard sets these once per profile (you can edit later in `~/.amx/config.yml`):

- `n_alternatives: 3` — how many candidate descriptions per column. The review wizard offers 1, 2, 3 keys to pick.
- `column_batch_size: 10` — how many columns AMX packs into one prompt. Bigger = cheaper / column, smaller = higher quality on wide tables.
- `temperature: 0.2` — deterministic by default. `0.4–0.7` for more variety in alternatives.
- `logprob_high: 0.85` / `logprob_medium: 0.50` — confidence thresholds for the `high` / `medium` / `low` buckets. See `/logprob-thresholds`.

Per-provider tuning notes live on each provider's page.

## Reasoning models — output budgeting {#reasoning-models}

Reasoning routes (OpenAI `o`-series and `gpt-5` reasoning variants, Anthropic
extended thinking on Claude Sonnet / Opus 4, DeepSeek-reasoner, and OpenRouter
thinking variants like Kimi K2.x, Qwen3-thinking, and GLM-4.6-thinking) can
spend the entire `max_tokens` budget on internal reasoning, leaving the
visible answer empty with `finish_reason=length`. To keep the answer slot
viable, AMX:

1. **Floors** the output budget for reasoning routes at **32 768 tokens**
   (`_DEFAULT_REASONING_FLOOR`). Override with the `AMX_LLM_MIN_MAX_TOKENS`
   env var if you've tuned a specific model.
2. **Auto-retries** once at `max_tokens × 4` (capped at **131 072 tokens**,
   `_REASONING_AUTO_RETRY_CAP`) when a reasoning call returns 0 visible
   characters and `finish_reason=length`. The retry only fires for reasoning
   routes; standard chat models keep the user's `max_tokens` as-is.
3. **Passes through `reasoning_effort`** to OpenAI / OpenRouter so a higher
   effort can be selected per LLM profile (`/llm` wizard).

The visible reasoning text — Anthropic `thinking` blocks, DeepSeek's
`reasoning_content` — is exposed as the **Reasoning trace** card on the
Studio Run detail Summary tab when the provider returns one, so the floor
buys you a useful answer **and** an inspectable thought trail.

## Costing rule of thumb

For a typical 47-table / 1,283-column schema, drafting descriptions once:

| Setup | Approximate cost |
|---|---|
| Live `gpt-4o-mini`, batch_size 10 | $1.00–$1.50 |
| Live `gpt-4o`, batch_size 10 | $4.00–$6.00 |
| Batch `gpt-4o-mini` | $0.50–$0.75 |
| Live `claude-sonnet-4` | $5.00–$8.00 |
| Live `gemini-2.0-flash`, batch_size 15 | $0.40–$0.80 |
| Local `llama3` on a workstation | $0 (bring your own GPU) |

Numbers are illustrative — actual cost depends on column-name length, sample-value
length, and the provider's per-token rate at the time.

AMX no longer makes you guess. Every LLM call reports both **tokens
and USD** at every surface that triggered it — `/run`, `/run-apply`,
`/ask`, the Studio run progress header, and the lifetime
cost card on the Studio Overview. Cost comes from a versioned
per-(provider, model) pricing table that AMX caches on disk with a
freshness timestamp; the Studio top bar shows a pricing-cache
freshness badge and a one-click refresh button. You can pin a
**price override** per model from Settings → LLM (an auto-detected
hint pre-fills the field). Every run row records both the price it
ran at (frozen) and the price it would cost today (live), so a stale
price never silently rewrites history. See
[Studio → Pricing](../studio/pricing.md) for the pricing browser and
[Studio → System → Token usage](../studio/system.md#token-usage) for
the windowed breakdown.

## Setup walkthroughs

Each provider page follows the same template: prerequisites → `/add-llm-profile`
walkthrough with verbatim wizard prompts → sample `~/.amx/config.yml` block → verify
steps → troubleshooting table → what to read next.

- [OpenAI](openai.md) — the default; logprob-threshold tuning.
- [Anthropic](anthropic.md) — Claude model selection, extended thinking.
- [Gemini](gemini.md) — model picks, safety-filter handling.
- [Databricks Serving](databricks-serving.md) — Foundation Models or custom serving endpoints; same workspace as your data.
- [DeepSeek](deepseek.md) — cheap, native logprobs, optional reasoning route.
- [OpenRouter](openrouter.md) — multi-model router, one key for many providers.
- [Kimi](kimi.md) — Moonshot's K2.x reasoning models.
- [Ollama and local](ollama-local.md) — on-prem / air-gapped setup.
- [Batch mode](batch-mode.md) — async / cheap drafts via OpenAI / Anthropic batch APIs.

## Override RAG with a separate profile

The RAG agent (which fuses documentation + codebase evidence into a column description)
can run on a different LLM profile than the one drafting columns. Useful when a cheaper
fast model is enough for prose synthesis but you still want a stronger model on the
column-drafting batch path.

```text
amx /llm /use-rag-llm
# Picker lists every LLM profile + a "(none)" entry to clear the override.
# Or non-interactive:
/use-rag-llm gpt-4o-mini       # pin the RAG agent to this profile
/use-rag-llm none              # clear the override (RAG falls back to active)
```
