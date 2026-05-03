# Common flags

A handful of flags appear on multiple commands. Listing them once here so you don't
have to memorise them per command. Each flag below works on `/run`, `/apply`,
`/run-apply`, `/sync`, and `/profile` unless otherwise noted.

## Prerequisites

- AMX installed.
- An active DB and LLM profile (run `/setup` if not).

## Flag reference

| Flag | Type | Default | What it does |
|---|---|---|---|
| `--db-profile <name>` | string | active profile | Override the active DB profile for this command only |
| `--llm-profile <name>` | string | active profile | Override the active LLM profile for this command only |
| `--scope <kind>` | `database`/`schema`/`table`/`column` | inferred | Force the scope picker level instead of inferring from positional args |
| `--profiling-mode <mode>` | `full`/`sampled`/`metadata` | profile default | Override the profiling mode for one run |
| `--profiling-sample-size <n>` | int | profile default (5000) | Override sample size when `--profiling-mode sampled` |
| `--review-all` | flag | off | Force the review wizard to walk every row, not just `low`-confidence ones |
| `--auto-accept-high` | flag | on | Bulk-accept `high`-confidence drafts. Pair with `--review-all` to override |
| `--apply` | flag | off | Auto-`/apply` after `/run` finishes. Skips the review wizard for high+medium |
| `--csv <path>` | string | — | Write the run's review queue to a CSV file in addition to (or instead of) the in-memory store |
| `--csv-only` | flag | off | Skip the in-memory store; writes only to the `--csv` path |
| `--debug` | flag | off | Verbose logging — every SQL statement, every LLM call, every retry |
| `--skip-network` | flag | off | Skip the connectivity check at command start (useful when `/doctor` already ran) |
| `--dry-run` | flag | off | On `/apply`: print the SQL that *would* run; don't execute |
| `--limit <n>` | int | — | On `/run`: limit to the first N tables in scope. Useful for incremental runs |
| `--filter <expr>` | string | — | On `/run`: restrict to tables whose name matches the regex |
| `--llm-batch-size <n>` | int | profile default (10) | Override `column_batch_size` for one run |

## Common combinations

### Sweep a whole warehouse cheaply

```bash
amx /run \
  --profiling-mode metadata \
  --llm-profile openai-mini \
  --auto-accept-high \
  --csv ~/amx-output/sweep-2026-05-03.csv
```

`metadata` mode skips row scans entirely (no warehouse cost), `--llm-profile openai-mini`
uses the cheap model, `--auto-accept-high` lets the review wizard skip ahead through
high-confidence rows, and the CSV gives you a portable record outside the AMX history
store.

### Re-run only the tables that failed last time

```bash
amx /run \
  --filter '^(stg_|fct_|dim_)' \
  --limit 50 \
  --debug
```

The regex matches your dbt-style staging / fact / dimension tables; `--limit 50` keeps
the run bounded; `--debug` surfaces the exact failure if it happens again.

### Apply without the review wizard

```bash
amx /run-apply \
  --auto-accept-high \
  --review-all=false \
  --apply
```

`/run-apply` is `/run` immediately followed by `/apply`. `--auto-accept-high` accepts
high-confidence drafts; everything else is queued for later interactive review.

!!! warning "Do not pair `--apply` with a freshly-tuned LLM profile"
    `--apply` skips the review wizard for high+medium confidence drafts. Until you've
    confirmed the LLM profile produces good descriptions for *your* schema, leave the
    wizard interactive. Re-add `--apply` only after one or two successful manual sweeps.

### Test profiling cost without LLM calls

```bash
amx /profile sales.customer \
  --profiling-mode full \
  --skip-network
```

`/profile` runs only the Profile agent — it samples the table and prints stats but
doesn't call the LLM. Use it to estimate how long full-mode profiling would take on
your warehouse before unleashing `/run`.

## Sample config — defaults that act like flags

Most flags have a per-profile default that lives in `~/.amx/config.yml`:

```yaml
db_profiles:
  prod-pg:
    backend: postgresql
    # ...
    profiling_mode: sampled            # → --profiling-mode default
    profiling_sample_size: 5000        # → --profiling-sample-size default

llm_profiles:
  openai-prod:
    provider: openai
    model: gpt-4o
    column_batch_size: 10              # → --llm-batch-size default
    n_alternatives: 3
    temperature: 0.2
    logprob_high: 0.85
    logprob_medium: 0.50
```

Set sensible defaults per profile so you only need flags for one-off overrides.

## What's next

- [Run & Apply](run-and-apply.md) — the most common command surface; flag combinations live here.
- [Profiling modes](../configuration/profiling-modes.md) — when to use `full` vs `sampled` vs `metadata`.
- [Environment variables](../configuration/env-vars.md) — flags you can also set globally via env.
