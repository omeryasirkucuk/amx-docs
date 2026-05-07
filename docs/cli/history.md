# `/history` & `/usage`

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
- **Apply events** (`apply_events` table, AMX 0.13+) — one row per successful
  COMMENT write with the prior text, the new text, the run id, and the
  user / host / profile. Powers [`/history rollback`](#rollback) and Studio's
  [Audit page](studio.md#audit-page).

## `/history` namespace

| Command | Description |
|---|---|
| `/list [-n N]` | Recent runs (includes `Duration(s)` and `Model(s)`) |
| `/show <run_id>` | Full run JSON (scope, metrics, tokens, results, errors) |
| `/stats` | Aggregate stats + search lifecycle counts |
| `/events [-n N]` | App events (profile switches, run status, apply outcomes, …) |
| `/results <run_id>` | All saved LLM alternatives for a past run |
| `/review <run_id>` | Re-evaluate alternatives interactively |
| `/rollback <run_id>` | Restore the COMMENTs that this run overwrote |
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

## `/rollback`

`/history rollback <run_id>` undoes a past `/apply` by restoring the
COMMENT each affected asset had **immediately before** the run wrote
to it.

```text
amx /history rollback 42                # interactive (preview + confirm)
amx /history rollback 42 --yes          # scripted; skip the prompt
```

Backed by the `apply_events` audit table — every successful
COMMENT write records the prior text alongside the new one, so
rollback restores **whatever was on the asset before**, not just
"what AMX wrote". The DBA's hand-typed comment, an export-tool's
default text, a previous AMX run's output — all valid sources to
roll back to.

### What rollback shows you first

```text
═══ Rollback run #42 ═══
Found 3 apply event(s); 3 restorable, 0 skipped (original unknown).

Will restore
  Asset                                Current (will be replaced)         Restoring to
  core.transactions.posting            Posting date encoded as YYYY…      Posting date (manual; legacy)
  core.transactions.amount             Amount in transaction currency…    Total amount in cents
  core.transactions.eff_dt             Effective date the row landed…     Warehouse arrival date

Restore 3 comment(s) by overwriting current values? [y/N]:
```

### Skipped rows (`old_comment` unknown)

Some rows surface as **skipped**: the audit row's `old_comment` is
`NULL`. Two situations produce this:

- The apply ran before the audit log started capturing pre-write
  values (anything before AMX 0.13).
- The active backend's adapter doesn't expose a comment-read API,
  so AMX could not capture the prior text.

Rollback never invents text — skipped rows are reported in the
summary and left untouched. To recover them, restore from a DB
backup or rerun the original DBA script.

### Replay order

When a single run wrote to the same asset multiple times (rare but
possible — e.g. a chained schema → table → column meta-apply),
rollback replays in **reverse time order**. The last write unwinds
first so the asset ends up holding whatever it had **before** the
run started.

### Failure handling

The rollback runs inside one `engine.begin()` transaction.
Per-row failures are reported but do not abort the rest:

```text
  ✓ core.transactions.posting
  ✗ core.transactions.amount: COMMENT requires schema USAGE
  ✓ core.transactions.eff_dt

⚠ Restored 2 of 3; 1 failed.
```

The failed rows stay on the run's `apply_events` so a retry after
fixing the privilege grant resumes from the same audit trail.

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
