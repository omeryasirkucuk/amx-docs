# Batch mode

For wide schemas, AMX can route a `/run` through the provider's Batch API instead of
synchronous chat. Batch APIs trade latency (24h SLA) for cost (~50% reduction).

## When to use Batch

- Schema has hundreds or thousands of columns.
- The work isn't blocking — you'll review tomorrow.
- You're cost-sensitive (e.g. covering a whole legacy SAP database).

When NOT to use it:

- You want results in minutes, not a day.
- The schema is small (< 50 columns) — overhead beats savings.
- You need the Search Agent loop (`/ask`) — Batch is for `/run` only.

## Supported providers

| Provider | API | Logprobs in batch results |
|---|---|---|
| OpenAI | [Batch API](https://platform.openai.com/docs/guides/batch) | ✓ |
| Anthropic | [Message Batches](https://docs.anthropic.com/en/api/creating-message-batches) | ✗ |

Other providers do not yet have AMX Batch support — they fall back to synchronous chat
when `--batch` is passed.

## Running a Batch run

```text
/run sap_s6p --batch
```

AMX:

1. Builds the per-column prompts as usual.
2. Submits them as a single batch job to the active LLM provider.
3. Records the batch job id and returns to the prompt — you can `/exit` and come back
   later.
4. On the next `/run` (or explicit `/history poll-batch <run_id>`), AMX checks job status
   and pulls completed results into the local store.
5. Once all batches are complete, the review wizard opens as if the run were synchronous.

The batch job id appears in `/history list` so you can track progress without leaving
AMX.

## Confidence in batch results

OpenAI Batch returns logprobs — confidence calibration works exactly as for synchronous
chat.

**Anthropic Batch does not return logprobs.** Batched results keep model-declared
confidence labels until merged by a logprob-capable chat call. The orchestrator marks them
as `confidence: model_declared` so you can tell them apart from logprob-calibrated ones in
the review wizard.

## Cost expectations

- OpenAI Batch: ~50% of synchronous pricing.
- Anthropic Batch: ~50% of synchronous pricing.

`/usage` reports actual token consumption from `~/.amx/history.db`, including batch jobs,
so you can confirm the saving.

## Mixing batch and chat

A common pattern:

1. **Batch** the bulk of the schema (`/run sap_s6p --batch`) overnight.
2. **Chat** for follow-up high-confidence accept-or-fix on the next morning.
3. **Re-batch** anything still ambiguous after manual review.

## Limitations

- Batch jobs cannot be cancelled mid-flight from AMX (use the provider's dashboard).
- A single batch job carries up to the provider's per-job token cap; AMX splits very wide
  schemas across multiple jobs and tracks them as a single AMX run.
- Anthropic Batch has stricter input-size limits than OpenAI; AMX automatically routes
  oversized prompts to chat instead.
- The Code and RAG agents still call chat for retrieval-side work even in `--batch` mode;
  only the per-column profile prompts go to Batch.
