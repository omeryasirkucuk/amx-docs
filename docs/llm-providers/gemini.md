# Google Gemini

## Setup

```text
/add-llm-profile gemini_main
```

Fields:

- **Provider:** `gemini`
- **Model id:** `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash-exp`, …
- **API key:** your `GOOGLE_API_KEY` (or `GEMINI_API_KEY`)

For Vertex AI–style auth (service account), set `GOOGLE_APPLICATION_CREDENTIALS` to point
at the service-account JSON before launching `amx`. The Gemini SDK picks it up
automatically.

## Recommended models

| Use case | Model | Why |
|---|---|---|
| Default `/run` | `gemini-1.5-flash` | Fast, very cheap, supports logprobs |
| High-stakes `/run` | `gemini-1.5-pro` | Better at nuanced descriptions |
| `/ask` | `gemini-1.5-flash` | Plenty for the Search Agent |
| Long-context | `gemini-1.5-pro` | 2M-token context window — useful for huge prompts |

## Logprobs

Gemini returns logprobs for chat completions. The orchestrator uses them to calibrate
confidence bands.

## Long context

Gemini's 1M+ context window is useful for two AMX features:

- `/run` against a wide table where the Profile Agent batch payload (column names,
  samples, FK metadata) gets large.
- `/ask` with `--context-detail deep` so the Search Agent has plenty of headroom for
  retrieved evidence.

`/llm-batch-size` can comfortably go higher with Gemini than with most other providers —
try `40-60` columns per call.

## Known gotchas

- Gemini has stricter content filters than the other providers. Some legitimate column
  descriptions trigger `safety_ratings` blocks on tables with adult / medical / legal
  semantics. The block surfaces as a refusal with provenance.
- Gemini's JSON-mode adherence is good but not perfect — when a response is malformed,
  AMX retries once with a tighter prompt. Persistent failures are logged.
- `gemini-2.0-flash-exp` is experimental — supported but expect occasional API surprises
  until it stabilises.
