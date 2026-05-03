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
- **On-prem / air-gapped** → [Ollama and local](ollama-local.md). Llama-3 / Qwen / DeepSeek work; logprob calibration is per-model.

## Provider matrix

| Provider | Default model | Cost lens | Logprobs | Batch API | Key file |
|---|---|---|---|---|---|
| [OpenAI](openai.md) | `gpt-4o` | Mid (cheap with `mini`) | ✓ native | ✓ ([batch](batch-mode.md)) | `sk-…` |
| [Anthropic](anthropic.md) | `claude-sonnet-4-20250514` | Mid–High | ✓ derived | ✓ ([batch](batch-mode.md)) | `sk-ant-…` |
| [Gemini](gemini.md) | `gemini-2.0-flash` | Low | ✓ native | ✗ in AMX yet | `AIza…` |
| OpenRouter | provider/model id | Varies (markup) | varies | ✗ | `sk-or-…` |
| DeepSeek | `deepseek-chat` | Very low | ✓ native | ✗ | API key |
| [Ollama / local](ollama-local.md) | `llama3` | Free (compute is yours) | varies | ✗ | optional |

`OpenRouter` and `Kimi` are routed through OpenAI-compatible HTTPS — see the wizard
prompts; they reuse the OpenAI client under the hood.

## Generation defaults that apply across all providers

The wizard sets these once per profile (you can edit later in `~/.amx/config.yml`):

- `n_alternatives: 3` — how many candidate descriptions per column. The review wizard offers 1, 2, 3 keys to pick.
- `column_batch_size: 10` — how many columns AMX packs into one prompt. Bigger = cheaper / column, smaller = higher quality on wide tables.
- `temperature: 0.2` — deterministic by default. `0.4–0.7` for more variety in alternatives.
- `logprob_high: 0.85` / `logprob_medium: 0.50` — confidence thresholds for the `high` / `medium` / `low` buckets. See `/logprob-thresholds`.

Per-provider tuning notes live on each provider's page.

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
length, and the provider's per-token rate at the time. Always run a single-table `/run`
first and check the LLM line for `tokens in / out` before unleashing it on a warehouse.

## Setup walkthroughs

Each provider page follows the same template: prerequisites → `/add-llm-profile`
walkthrough with verbatim wizard prompts → sample `~/.amx/config.yml` block → verify
steps → troubleshooting table → what to read next.

- [OpenAI](openai.md) — the default; logprob-threshold tuning.
- [Anthropic](anthropic.md) — Claude model selection, extended thinking.
- [Gemini](gemini.md) — model picks, safety-filter handling.
- [Ollama and local](ollama-local.md) — on-prem / air-gapped setup.
- [Batch mode](batch-mode.md) — async / cheap drafts via OpenAI / Anthropic batch APIs.

## What's next

- [Quick start](../getting-started/quickstart.md) — five-minute install-to-first-comment walkthrough.
- [Run & Apply](../cli/run-and-apply.md) — what happens between `/run` and `/apply`, including review-wizard keystrokes.
- [Configuration: env vars](../configuration/env-vars.md) — provider-specific env vars (proxies, API base overrides).
