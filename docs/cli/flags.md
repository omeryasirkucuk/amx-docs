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
| `--apply` | flag | off | Auto-`/apply` after `/run` finishes, using the review strategy you pick |
| `--csv <path>` | string | — | Write the run's review queue to a CSV file in addition to (or instead of) the in-memory store |
| `--csv-only` | flag | off | Skip the in-memory store; writes only to the `--csv` path |
| `--debug` | flag | off | Verbose logging — every SQL statement, every LLM call, every retry |
| `--skip-network` | flag | off | Skip the connectivity check at command start (useful when `/doctor` already ran) |
| `--dry-run` | flag | off | On `/apply`: print the SQL that *would* run; don't execute |
| `--limit <n>` | int | — | On `/run`: limit to the first N tables in scope. Useful for incremental runs |
| `--filter <expr>` | string | — | On `/run`: restrict to tables whose name matches the regex |
| `--llm-batch-size <n>` | int | profile default (10) | Override `column_batch_size` for one run |
| `--n-alternatives <n>` | int (1-5) | profile default | On `/run`: number of drafts to surface per asset |
| `--verbosity <mode>` | `terse`/`balanced`/`verbose` | `balanced` | On `/run`: target output length |
| `--temperature <f>` | float [0.0, 2.0] | profile default | Sampling temperature for this command only |
| `--prompt-detail <mode>` | `low`/`auto`/`high` | `auto` | How much profile/RAG context to feed the LLM |

## REPL-only commands

A few slash commands are not flags but they shape the same dimensions:

| Command | Effect |
|---|---|
| `/max-tokens` | Show the active LLM profile's per-call output budget |
| `/max-tokens <n>` | Set the budget. Reasoning models (Claude extended-thinking, GPT-5 / o-series, DeepSeek-reasoner, Kimi K2.x) automatically get an additional 32 k reasoning floor on top |
| `/temperature <f>` | Show or set the active LLM profile's default temperature |
| `/n-alternatives <n>` | Show or set the default number of drafts |
| `/profiling [full\|sampled\|metadata] [max_rows] [sample_size]` | Configure the profiling mode and guardrails per profile (there is no `--profiling-mode` flag) |

The review strategy (one-by-one, accept-all-high, accept-all, reject-all) is
chosen **interactively** at the review step, not via a flag.

## Common combinations

### Sweep a whole warehouse cheaply

```bash
> /profiling metadata          # set the profile's mode first — no per-run flag
> /run \
  --llm-profile openai-mini \
  --csv ~/amx-output/sweep-2026-05-03.csv
```

`metadata` mode skips row scans entirely (no warehouse cost) and `--llm-profile openai-mini`
uses the cheap model; the CSV gives you a portable record outside the AMX history
store. At the review step, pick the accept-all-high strategy to skip ahead through
high-confidence rows.

### Re-run only the tables that failed last time

```bash
> /run \
  --filter '^(stg_|fct_|dim_)' \
  --limit 50 \
  --debug
```

The regex matches your dbt-style staging / fact / dimension tables; `--limit 50` keeps
the run bounded; `--debug` surfaces the exact failure if it happens again.

### Apply high-confidence drafts in one shot

```bash
> /run-apply --apply
```

`/run-apply` is `/run` immediately followed by `/apply`. At the review step pick the
accept-all-high strategy: high-confidence drafts are accepted and everything else is
queued for later interactive review.

!!! warning "Be careful with `--apply` on a freshly-tuned LLM profile"
    `--apply` writes back whatever the chosen review strategy accepts. Until you've
    confirmed the LLM profile produces good descriptions for *your* schema, review
    one-by-one. Re-add `--apply` only after one or two successful manual sweeps.

### Test profiling cost without LLM calls

```bash
> /profiling full              # set the profile's mode first — no per-run flag
> /profile sales.customer \
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
    profiling_mode: sampled            # set via /profiling
    profiling_sample_size: 5000        # set via /profiling

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
