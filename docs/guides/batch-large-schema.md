# Guide: batching a large schema

For schemas with hundreds or thousands of columns, synchronous `/run` ties up your
terminal and your LLM rate-limit budget. Batch mode submits the run asynchronously,
returns control to you immediately, and stitches results back when the provider finishes.

## When this is the right shape

Use Batch when:

- The schema has 500+ columns to profile.
- You're not blocked on the result — tomorrow morning is fine.
- You're using OpenAI or Anthropic (the two providers AMX supports for Batch).

Use synchronous chat when:

- The schema is small (< 50 columns).
- You're iterating on prompts and want immediate feedback.
- You need the result in the next 30 minutes.

## Submitting the batch

```text
/use-llm openai_main
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

The next time AMX starts, it polls open batch jobs and pulls completed results into the
local store automatically. To force a poll without restarting:

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

## Mixed strategies

A common pattern for very large schemas:

1. **Inventory first.** `/db profiling metadata; /run sap_s6p --batch` — overnight,
   minimum impact on the warehouse. Get a description for every table that has a useful
   name.
2. **Targeted high-quality.** Switch to `/db profiling sampled` and `/use-llm openai_main`
   (full-size model). `/run sap_s6p.<critical_tables> --batch` — overnight again, this
   time with proper profiling and the better model.
3. **Manual cleanup.** Synchronous `/run sap_s6p.<one_table>` for the dozen tables that
   ended up with low-confidence output, with you watching the wizard.

This pattern lets you cover a huge schema while keeping high-stakes review work focused.

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
