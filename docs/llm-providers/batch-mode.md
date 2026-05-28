# Batch mode

For wide schemas, AMX can route a `/run` through the provider's Batch API instead of
the live chat API. You pay roughly **half the live-call price** in exchange for an
asynchronous SLA — the provider returns results within minutes-to-hours instead of
seconds. This page walks through enabling batch mode, submitting and polling a batch,
checking provider dashboards for in-flight status, and reviewing the results.

## Prerequisites

- AMX installed (`pip install amx-cli`).
- An active LLM profile on a provider that supports batch — currently **OpenAI** and **Anthropic**.
- An active database profile.
- A schema with enough columns to benefit from batch — anything under ~50 columns is faster (and not meaningfully cheaper) on the live API.

## Step-by-step

### 1. Enable batch mode for the active LLM profile

Edit `~/.amx/config.yml` and add `batch_mode: true` under the LLM profile:

```yaml
llm_profiles:
  openai-batch:
    provider: openai
    model: gpt-4o-mini             # cheap models pair well with batch
    api_key: keyring://amx/openai-batch/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 20          # bigger batches = fewer batch jobs
    batch_mode: true
    batch_poll_interval_s: 60      # how often AMX polls the provider
    batch_max_wait_s: 86400        # 24h timeout (provider SLA)
active_llm_profile: openai-batch
```

Then restart AMX — config changes are picked up at session start.

### 2. Submit a batch `/run`

```text
> /run sales
[scope] 47 tables · 1,283 columns
[Profile] sampled scan on 47 tables ... ok in 18.4 s
[LLM]     submitting OpenAI batch (1,283 columns, 64 requests, est. cost: $1.42)
          → batch id: batch_abc123def456
          → provider dashboard: https://platform.openai.com/batches/batch_abc123def456
          → polling every 60 s ...
```

`/run` does not block your terminal — you can `/exit`, restart later, and resume polling
with `/batch resume <batch-id>`. The batch id is also written to `/history` so you can
look it up via `/history list --filter batch`.

### 3. Watch the batch progress

```text
> /batch status
batch_abc123def456 [openai/gpt-4o-mini]
  state: in_progress
  submitted: 2 min ago
  requests: 64 total · 28 finished · 36 in-progress · 0 failed
  est. completion: ~7 min
```

Or open the provider dashboard for a UI view:

- **OpenAI**: [platform.openai.com/batches](https://platform.openai.com/batches) — shows progress, errors, and download links.
- **Anthropic**: [console.anthropic.com/batches](https://console.anthropic.com/batches).

When AMX polls and sees `state: completed`, it downloads and parses results
automatically; you'll see a notification at the next prompt:

```text
> /batch status
batch_abc123def456 [openai/gpt-4o-mini]
  state: completed
  duration: 9 min 12 s
  requests: 64 total · 64 finished · 0 failed
  → results merged into the review queue
```

### 4. Review and apply

When the batch results land, `/run` enters its interactive review the same way a
live run does — you pick a review strategy (one-by-one / accept-all-high /
accept-all / reject-all) at the prompt:

```text
1,283 columns drafted · high: 1,021 · medium: 198 · low: 64
Review row 1/64 (low confidence): sales.customer.x_legacy_status
  1) "Legacy status flag preserved during the 2018 migration; values 0–7 map to..."
  2) "..."
  3) "..."
Pick a description by number, "s" to skip, or "o" to type your own:
> 1
...

> /apply
Write 1,283 comment(s) to db-prod/sales? [y/N]: y
... (1,283/1,283 written)
✓ /apply finished. Audit trail: /history show <run-id>
```

If you closed the session before reviewing, pick the drafts back up later with
`/analyze review` or `/history review` instead of re-running the batch.

## Cost / time trade-offs

| Mode | Provider price | Wall time (1,000 cols) | When to use |
|---|---|---|---|
| Live (default) | $1.00 / 1k cols at `gpt-4o-mini` | ~30 s | Day-to-day single-table runs; iterating on prompts |
| Batch | $0.50 / 1k cols at `gpt-4o-mini` | 5 min – 24 h | Whole-warehouse drafts; nightly sweeps; CI pipelines |

Batch is also strictly cheaper than running the live API in parallel up to your tier
cap — you don't burn rate-limit budget that you might want for ad-hoc `/ask` queries
later in the day.

## Sample config

OpenAI batch:

```yaml
llm_profiles:
  openai-batch:
    provider: openai
    model: gpt-4o-mini
    api_key: keyring://amx/openai-batch/api_key
    column_batch_size: 20
    batch_mode: true
    batch_poll_interval_s: 60
    batch_max_wait_s: 86400
```

Anthropic batch:

```yaml
llm_profiles:
  anthropic-batch:
    provider: anthropic
    model: claude-haiku-3-5-20250101
    api_key: keyring://amx/anthropic-batch/api_key
    column_batch_size: 25
    batch_mode: true
    batch_poll_interval_s: 60
    batch_max_wait_s: 86400
```

## Verify

1. `> /llm test` — pings the chat API (not the batch API) to confirm credentials. Batch jobs use the same key.
2. `> /batch status` — shows in-flight jobs and their state. Empty if no jobs are pending.
3. Open the provider dashboard URL printed at submission time — confirms the job is registered server-side.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `OpenAI batch endpoint not enabled for project` | Project hasn't been opted into the Batch API tier | Enable in [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits) |
| Batch state `failed` with `partial_failure: 12 / 64` | Some requests hit the model's per-request token limit | Lower `column_batch_size`; `/run --recover-batch <batch-id>` retries only the failed sub-requests on the live API |
| Polling never returns / state stuck on `validating` | Provider validation queue is backed up (rare) | Wait; if still stuck after 30 min, cancel via the dashboard and re-submit |
| `batch_max_wait_s` exceeded | Schema is wider than the timeout allows | Bump `batch_max_wait_s` to `172800` (48 h) or split the schema across multiple `/run` calls |
| Anthropic batch job returns half the columns | Anthropic batch supports up to 100k requests per job — but each request is one column batch, not one column | Confirm `column_batch_size` is 20+ so you stay under the request cap |
| Cost was higher than estimate | The estimate is provider-list-price × tokens; usage tier discounts and prompt-caching discounts aren't included | Check the dashboard "Costs" view for the actual billed amount |
