# Anthropic

Direct Anthropic API for Claude models.

## Setup

```text
/add-llm-profile anthropic_main
```

Fields:

- **Provider:** `anthropic`
- **Model id:** `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`,
  `claude-opus-4`, `claude-sonnet-4`, `claude-3-7-sonnet`, …
- **API key:** your `ANTHROPIC_API_KEY`

## Recommended models

| Use case | Model | Why |
|---|---|---|
| Default `/run` | `claude-3-5-sonnet-latest` | Strong baseline, fast |
| Cheap `/run` | `claude-3-5-haiku-latest` | ~10x cheaper, surprisingly competent |
| `/ask` | `claude-3-5-sonnet-latest` | Good at multi-step Search Agent loops |
| Reasoning-heavy | `claude-opus-4` / `claude-sonnet-4` / `claude-3-7-sonnet` | Auto-raised token floor (16384) for extended thinking |

## Extended thinking

Claude's extended-thinking routes (Opus 4, Sonnet 4, 3.7-Sonnet) are recognised as
reasoning routes. AMX:

- Auto-raises `max_tokens` to 16384 so internal thinking doesn't consume the visible-output
  budget.
- Routes through the same agent code paths as any other model.

## Logprobs

Anthropic chat completions return token logprobs which AMX consumes for confidence
calibration.

**Anthropic Batch (Message Batches API) does NOT return token logprobs.** Batched results
keep the model-declared confidence labels until merged by a logprob-capable chat call.
This is one reason `/run` defaults to synchronous chat — Batch is opt-in via `--batch`.

## Batch API

Anthropic Message Batches is supported — see [Batch mode](batch-mode.md). 24-hour SLA,
~50% cost. The lack of logprobs in batch responses means confidence is less precise; the
orchestrator falls back to model-declared bands.

## Known gotchas

- Anthropic models tend to produce longer descriptions than OpenAI for the same prompt.
  `prompt-detail standard` is well-tuned for OpenAI; consider `minimal` for Anthropic to
  keep outputs concise.
- Claude refuses some prompts that mention legal/medical-sounding column names. AMX
  surfaces the refusal with provenance; the column gets a "skipped — provider refusal"
  status that you can re-evaluate later with `/history review`.
- Extended-thinking routes are slow. For wide schemas, prefer Sonnet over Opus and use
  Batch where possible.
