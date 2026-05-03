# OpenAI

Configure OpenAI as the LLM provider for AMX's three sub-agents (Profile, RAG, Code).
This is the most battle-tested provider in AMX — every prompt template and confidence-
score calibration is validated against it first. This page walks through registering an
OpenAI profile, picking a model, tuning logprob thresholds, and confirming the profile
is reachable.

## Prerequisites

- AMX installed (`pip install amx`).
- An OpenAI API key with access to at least one chat-completion model (`gpt-4o`, `gpt-4o-mini`, `o3-mini`, etc.). Get one at [platform.openai.com](https://platform.openai.com/api-keys).
- A funded OpenAI account or enough free credit. AMX surfaces 429 / quota errors clearly but it cannot mint credits for you.
- An active database profile (or follow [Quick start](../getting-started/quickstart.md) first).

## Step-by-step

### 1. Open the AMX REPL

```bash
amx
```

### 2. Add an LLM profile

```text
> /add-llm-profile
```

The wizard asks for a profile name (e.g. `openai-prod`), then walks the provider picker. Pick `openai`:

```text
Select AI provider:
  openai
  openrouter
  anthropic
  gemini
  deepseek
  local
  kimi
  ollama
> openai
```

### 3. Answer the model + key prompts

```text
Model: use the provider's natural model id. AMX will add any required provider prefix internally.
OpenAI model example: gpt-4o
Model name: gpt-4o
API key: ••••••••••••••••••••••••••••••••
Generation settings:
  Alternatives (1-5): 3
  Column batch size: 10
  Temperature (0.0-2.0): 0.2
Confidence thresholds (token probability 0.0-1.0):
  High threshold: 0.85
  Medium threshold: 0.50
```

Notes on each field:

- **Model name** — type the bare OpenAI model id. AMX normalises it internally (no `openai/` prefix needed). Common picks below.
- **API key** — `sk-…`. Stored in the OS keychain when one is available, otherwise written to `~/.amx/config.yml` with mode `0600`.
- **Alternatives** — how many candidate descriptions the LLM generates per column. The review wizard lets you pick between them with number keys. Defaults to 3; raise to 5 only when you're tuning the prompt.
- **Column batch size** — how many columns AMX packs into a single prompt. Larger batches are cheaper per column but lower-quality on very wide tables. 10 is a sweet spot.
- **Temperature** — defaults to `0.2` (deterministic, reproducible). Bump to `0.4–0.7` for more variety in alternatives; never above `1.0` for description-drafting work.
- **Logprob thresholds** — token probability cut-offs that decide which suggestions land in the `high` / `medium` / `low` confidence buckets shown by `/run`. Defaults `0.85` / `0.50` work for `gpt-4o`. See "Tuning logprob thresholds" below.

!!! tip "Which OpenAI model should I pick?"
    - **`gpt-4o`** (default) — best quality / latency trade-off. The default for AMX.
    - **`gpt-4o-mini`** — ~10x cheaper, ~70% as good for simple description drafting. Use for whole-warehouse sweeps in `metadata` mode.
    - **`o3-mini` / `o4-mini`** — reasoning models. Higher quality on ambiguous columns but slower (and don't return logprobs the same way — `high`/`medium`/`low` buckets degrade).
    - **`gpt-4-turbo`** — legacy. Stick to `gpt-4o` unless you have an Azure deployment that pins to it.

### 4. Activate and confirm

```text
> /use-llm openai-prod
✓ Active LLM profile → openai-prod [openai] gpt-4o

> /llm test
[openai] gpt-4o ... ✓ reached (latency: 612 ms, tokens: 12 in / 8 out)
```

`/llm test` issues a tiny ping completion (`"Reply with the single word ACK"`) so you
catch auth and quota errors before launching a full `/run`.

### 5. Tune logprob thresholds (optional)

```text
> /logprob-thresholds
Current logprob thresholds: HIGH >= 0.85 | MEDIUM >= 0.50
Run /logprob-thresholds <high> <med> to change (e.g. 0.9 0.6).

> /logprob-thresholds 0.9 0.55
✓ Updated thresholds: HIGH >= 0.90 | MEDIUM >= 0.55
```

The thresholds are token-probability averages across the generated description. Tighter
thresholds (e.g. `0.95 / 0.7`) push more suggestions into `low` so the review wizard
forces you to look at them; looser thresholds (e.g. `0.7 / 0.4`) trust the LLM more and
let bulk-accept land more rows. Re-tune after a few `/run` sweeps based on which
confidence bucket actually correlates with edits in your domain.

### 6. Run a real description sweep

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok (rows: 5000)
[LLM]     openai/gpt-4o, batch 10, 18 columns ... ok in 4.2 s
          confidence: high 12 · medium 4 · low 2
```

## Sample config

The wizard above writes this block to `~/.amx/config.yml`:

```yaml
llm_profiles:
  openai-prod:
    provider: openai
    model: gpt-4o
    api_key: keyring://amx/openai-prod/api_key
    temperature: 0.2
    n_alternatives: 3
    column_batch_size: 10
    logprob_high: 0.85
    logprob_medium: 0.50
active_llm_profile: openai-prod
```

For Azure OpenAI deployments, see [Environment variables](../configuration/env-vars.md)
to point AMX at your Azure endpoint via `OPENAI_API_BASE` instead of registering a
separate provider.

## Verify

1. `> /llm test` — pings the model with a one-token completion. Surfaces auth / quota errors before you invest in a real run.
2. `> /llm` — shows the active profile, current model, and threshold settings.
3. `> amx doctor` — confirms the profile reaches the API and the model id resolves.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `openai.AuthenticationError: Incorrect API key provided` | Key revoked / typo | Re-issue at [platform.openai.com/api-keys](https://platform.openai.com/api-keys); re-run `/add-llm-profile` |
| `openai.RateLimitError: Rate limit reached for gpt-4o … Limit: 10000 / min` | TPM tier too low for the column batch size | Lower `column_batch_size` to 5–7, or upgrade your usage tier |
| `openai.NotFoundError: The model 'gpt-4-turbo-2024-04-09' does not exist` | Model id changed or your account doesn't have access | Use `gpt-4o` (broadly available) and confirm in the OpenAI dashboard which models your key can reach |
| All suggestions land in `low` confidence | Reasoning model returns no logprobs the way chat models do | Use a chat model (`gpt-4o`) for AMX, OR loosen the thresholds via `/logprob-thresholds 0.7 0.4` so reasoning-model output isn't punished |
| `openai.APIConnectionError: Connection error` repeatedly | Corporate proxy intercepting TLS | Set `HTTPS_PROXY` and a CA bundle (`SSL_CERT_FILE`); see [TLS and proxies](../configuration/tls-and-proxies.md) |
| Cost surprise | Default `column_batch_size: 10` × wide tables × 3 alternatives can run up | Switch to `gpt-4o-mini` for sweeps; or use [Batch mode](batch-mode.md) for ~50% off |

## What's next

- [Batch mode](batch-mode.md) — submit `/run` jobs to OpenAI's batch API for ~50% cheaper async drafts.
- [Anthropic](anthropic.md) — same template; useful as a parallel profile for cross-model description quality comparisons via `/history compare`.
- [Run & Apply](../cli/run-and-apply.md) — review wizard keystrokes (1-3 to pick alternatives, A to accept, S to skip).
