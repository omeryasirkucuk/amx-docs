# Batch mode

For wide schemas, AMX can route a `/run` through the provider's Batch API instead of
synchronous chat. Batch mode submits the entire run as one job, returns to the prompt
immediately, and stitches results back into the local store as soon as the provider
finishes (typically 1-6 hours, with a 24-hour SLA).

## When to use Batch

- Schema has hundreds or thousands of columns.
- The work isn't blocking — you'll review tomorrow.
- You're using OpenAI or Anthropic (the two providers AMX supports for Batch).

When NOT to use it:

- You want results in minutes, not a day.
- The schema is small (< 50 columns) — overhead beats throughput.
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

What happens:

1. AMX builds the per-column prompts as it would for synchronous chat.
2. Instead of dispatching them as chat completions, it packages them as a Batch API
   submission.
3. The batch job id is recorded in `~/.amx/history.db` and printed.
4. AMX returns to the prompt — you can `/exit` and come back later.

```text
/history list -n 5
```

shows the batch run with status `submitted`. The duration column will be empty until
results come back.

## Polling for completion

You can leave it alone — the next time AMX starts, it polls open batch jobs and pulls
completed results into the local store automatically. To force a poll without restarting:

```text
/history poll-batch <run_id>
```

When the job is complete, the run status flips to `completed` and the review wizard opens
on the next `/run` (or you can open it directly via `/history review <run_id>`).

## OpenAI Batch specifics

- 24-hour SLA, usually completes in 1-6 hours.
- Returns logprobs so confidence calibration is identical to synchronous chat.
- Per-job token cap; AMX splits very wide schemas across multiple jobs and tracks them as
  a single AMX run.

## Anthropic Batch specifics

- 24-hour SLA, usually completes in 1-6 hours.
- **Does NOT return token logprobs.** Confidence falls back to model-declared bands. The
  orchestrator marks these as `confidence: model_declared` so you can tell them apart in
  the review wizard.
- Stricter input-size limits than OpenAI; AMX automatically routes oversized prompts to
  chat instead.

## During the batch window

While the batch is running, you can:

- Ingest new documents (`/ingest`) — they'll be in the catalog by the time the review
  opens.
- Scan a fresh code repo (`/code-scan`) — same.
- Run `/ask` queries — they hit the catalog, not the LLM dispatch path.
- Submit another batch to a different LLM profile — they run in parallel.

What you can't do:

- Cancel a batch from AMX (use the provider's dashboard).
- Mix synchronous chat and batch dispatch within the same `/run` (the run picks one
  dispatch mode at start time).

## Reviewing batch results

When the batch is complete, the review wizard works exactly as for synchronous runs.
Logprob calibration is identical for OpenAI Batch; for Anthropic Batch, expect the
confidence bands to be more conservative (model-declared rather than logprob-derived).

Bulk-accept high-confidence rows and walk the medium / low ones manually. The save-back
to history happens automatically as you go.

## Limitations

- Batch jobs cannot be cancelled mid-flight from AMX (use the provider's dashboard).
- A single batch job carries up to the provider's per-job token cap; AMX splits very wide
  schemas across multiple jobs and tracks them as a single AMX run.
- Anthropic Batch has stricter input-size limits than OpenAI; AMX automatically routes
  oversized prompts to chat instead.
- The Code and RAG agents still call chat for retrieval-side work even in `--batch` mode;
  only the per-column profile prompts go to Batch.
