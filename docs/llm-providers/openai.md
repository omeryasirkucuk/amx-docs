# OpenAI

Direct OpenAI API. The most battle-tested provider in AMX.

## Setup

```text
/add-llm-profile openai_main
```

Fields:

- **Provider:** `openai`
- **Model id:** any current OpenAI chat model (`gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-5`, …)
- **API key:** your `OPENAI_API_KEY`
- **Base URL:** leave empty (defaults to OpenAI)

## Recommended models

| Use case | Model | Why |
|---|---|---|
| Default `/run` | `gpt-4o-mini` | Cheap, fast, supports logprobs |
| High-stakes `/run` | `gpt-4o` | Better at nuanced descriptions |
| `/ask` | `gpt-4o-mini` | Search Agent rarely needs the heavyweight |
| Cost-sensitive batch | `gpt-4o-mini` via Batch | ~50% cost vs synchronous |
| Reasoning-heavy domain | `o3-mini` / `gpt-5` | Auto-raised token floor (16384) |

## Reasoning routes

When the model id is recognised as a reasoning route (`o-series`, `gpt-5`), AMX:

- Auto-raises `max_tokens` to `_DEFAULT_REASONING_FLOOR` (16384) so the model doesn't
  burn its whole output budget on internal thinking.
- Passes the OpenAI-shaped `reasoning_effort` kwarg (`low` / `medium` / `high`).

Override via env vars:

- `AMX_LLM_MIN_MAX_TOKENS=16384` (default)
- `AMX_REASONING_EFFORT=low|medium|high` (default `medium` for OpenAI direct)

## Logprobs

OpenAI returns token-level logprobs. AMX uses them to score each suggestion's text and
calibrate the confidence band. Tune the bands with `/llm-thresholds`:

```text
/llm-thresholds 0.85 0.6     # high ≥ 0.85, medium ≥ 0.6, otherwise low
```

## Batch API

OpenAI Batch is supported and recommended for very large schemas — see
[Batch mode](batch-mode.md). Batch jobs:

- Run asynchronously (24h SLA).
- Cost ~50% of synchronous calls.
- Return logprobs (so confidence calibration still works).
- Are tracked in `/history` like any other run.

```text
/run sap_s6p --batch
```

## Org / project headers

For multi-tenant OpenAI accounts, set additional fields in the LLM profile:

- `organization` → sent as `OpenAI-Organization`
- `project` → sent as `OpenAI-Project`

## Known gotchas

- OpenAI rate-limits per-key. For wide-schema runs hit the Batch API instead of synchronous
  calls.
- Some legacy fine-tuned models don't return logprobs; AMX falls back to whole-response
  confidence.
- `gpt-5` is recognised as a reasoning route — the auto-raised token floor adds latency
  vs `gpt-4o`. Use `gpt-4o-mini` if you don't need it.
