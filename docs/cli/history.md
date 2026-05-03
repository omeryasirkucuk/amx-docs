# `/history` and `/usage`

Every `/run`, `/run-apply`, `/ask`, and `/apply` lands in the local SQLite store at
`~/.amx/history.db`. `/history` is the read interface; `/usage` summarises token counts
over a window.

## What's persisted

- `/analyze run` history (status, mode, duration, backend / provider / model, scope)
- Token usage (summary + per-step records)
- Approved / skipped metadata results
- Run failures (error text)
- App events (profile switches, run status, apply outcomes, …)
- **All LLM-generated alternatives per column / table per run** — every merged suggestion
  set is saved before human review so you can revisit and change your mind at any time.

## `/history` namespace

| Command | Description |
|---|---|
| `/list [-n N]` | Recent runs (includes `Duration(s)` and `Model(s)`) |
| `/show <run_id>` | Full run JSON (scope, metrics, tokens, results, errors) |
| `/stats` | Aggregate stats + search lifecycle counts |
| `/events [-n N]` | App events (profile switches, run status, apply outcomes, …) |
| `/results <run_id>` | All saved LLM alternatives for a past run |
| `/review <run_id>` | Re-evaluate alternatives interactively |
| `/compare [RUN_IDS…] [flags]` | Pivot runs side-by-side |

## Re-reviewing past runs

```text
/history review <run_id>                       # walk every column again
/history review <run_id> --unevaluated-only    # only columns you skipped
/history review <run_id> --apply               # short-circuit to writing on accept
```

Useful when:

- You ran the agents weeks ago and your domain knowledge has improved.
- A column you skipped now has clearer evidence (new code / docs ingested since).
- You want to compare suggestions from two different LLM profiles side-by-side before
  committing.

## `/compare`

`/history compare` is the heaviest tool in the namespace — pivots multiple runs side by
side across four Rich tables:

1. **Run summary** — identity (profiles, model, duration, approval rate). Highlights the
   dimension that varies between runs.
2. **Run settings** — prompt detail, language, batch size, n alternatives, dedup /
   missing-only flags, review strategy. Exactly which knobs you tuned between runs.
3. **Per-column results** — top description + confidence band + `logprob_score` + tokens.
   Best logprob per row in green.
4. **Aggregate metrics** — timing + tokens + confidence distribution. Best per row bolded.

### Flags

| Flag | Description |
|---|---|
| `--last N` | Compare the last N runs |
| `--schema NAME` | Restrict to one schema |
| `--table NAME` | Restrict to one table |
| `--column NAME` | Restrict to one column |
| `--command analyze.run\|search.ask\|all` | Filter by command type |
| `--by auto\|llm_profile\|doc_profile\|code_profile\|llm_model\|db_profile` | Group by dimension |
| `--diff` | Word-level highlights vs the leftmost run |
| `--csv FILE` | Also write the comparison as CSV |
| `--md FILE` | Also write as markdown |
| `--json FILE` | Also write as JSON |

JSON output pairs cleanly with pandas / Jupyter. The shape is documented in the AMX repo
under `tests/eval/README.md`. The keys `schema_version`, `run_summary`, `per_column`, and
`aggregate_metrics` are stable.

### Examples

Compare the last three runs against `t001`, with diff highlights:

```text
/history compare --last 3 --table t001 --diff
```

Compare two specific run IDs grouped by LLM model:

```text
/history compare 142 159 --by llm_model
```

Export to JSON for downstream analysis:

```text
/history compare --last 5 --schema sap_s6p --json /tmp/sap_s6p_runs.json
```

## `/usage`

```text
/usage             # last 7 days (default)
/usage 24h
/usage 30d
/usage all
```

Reads from `~/.amx/history.db` only — **no network calls**. The summary breaks down
prompt and completion tokens per LLM profile and per model, so you can see which models
your team uses most.

## Where it lives on disk

```
~/.amx/
├── config.yml
├── history.db          # SQLite — the table set described above
└── logs/amx.log
```

The SQLite schema is part of the public contract — additive migrations within a major
version, column types and meanings stable. See [Python API](../api/index.md#on-disk-formats)
for the full guarantees.

## Sharing history across a team

By default `~/.amx/history.db` is per-machine. Enable [shared mode](../collaboration/shared-history-store.md)
to dual-write every run, result, and event to a backend the team already owns. Reads still
come from local SQLite — cross-machine read views are slated for a follow-up minor.
