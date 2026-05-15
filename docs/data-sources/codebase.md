# Codebase

The Code Agent reads your application code looking for references to tables and columns,
then feeds those snippets to the LLM as evidence when drafting descriptions. A column
that's only used in `SELECT * FROM …` is uninformative; a column referenced in
`if customer.flagged_at: send_alert(...)` tells you exactly what it means. This page
walks through registering a code profile, scanning the repo, and tuning the cache to
keep re-scans cheap.

## Prerequisites

- AMX installed.
- A local checkout of the codebase you want indexed (or a Git URL AMX will clone).
- An active LLM profile (used for the per-snippet semantic embedding step).

## Step-by-step

### 1. Register a code profile

```text
> /add-code-profile
Profile name: dbt-prod
Path or Git URL: /Users/me/work/dbt-project
✓ Registered code profile 'dbt-prod' → /Users/me/work/dbt-project
```

For Git URLs, AMX clones into `~/.amx/code-cache/<profile>/` on first scan and pulls
on subsequent scans (so re-scans pick up upstream changes without you doing anything).

### 2. Scan the codebase

```text
> /code-scan
[1/4] Walking files at /Users/me/work/dbt-project ......  ok (1,247 files, 312 .sql, 89 .py)
[2/4] Extracting table/column references ..............  ok (4,128 refs)
[3/4] Embedding snippets ...............................  ok (412 unique chunks, $0.04)
[4/4] Updating code-RAG index ..........................  ok
✓ /code-scan finished in 18.4 s. Cache: ~/.amx/code-cache/dbt-prod
```

The scan is incremental — re-running picks up only files whose mtime changed since
the last scan, so subsequent scans are seconds rather than minutes.

### 3. Inspect what got indexed

```text
> /code-scan status
Profile: dbt-prod (active)
Path: /Users/me/work/dbt-project
Last scan: 5 min ago (1,247 files, 4,128 refs)
Top referenced tables:
  fct_orders                  413 refs
  dim_customer                289 refs
  fct_order_summary           204 refs
  stg_shopify__order_line     188 refs
  fct_revenue_daily           156 refs
```

If a table you'd expect to see is missing, the file extension probably isn't in the
default scan list. See "Tuning the scan" below.

### 4. Run with code evidence

```text
> /run sales.customer
[Profile] sampled scan on sales.customer ... ok
[RAG]     no document profile active — skipping
[Code]    found 89 references to sales.customer across 18 files; embedding ... ok
[LLM]     drafting 18 column descriptions with code evidence ... ok
          confidence: high 16 · medium 2 · low 0
```

Compare to the same `/run` without the code profile active — you'll typically see
several columns moving from `medium` to `high` confidence because the LLM now has
real usage examples to ground on.

### 5. Inspect the evidence used for one column

```text
> /code-analyze sales.customer.x_legacy_status
Found 8 references in 3 files. Top 3 (by relevance):

  models/marts/customer.sql:42
    case when c.x_legacy_status in (1,2) then 'active'
         when c.x_legacy_status = 3 then 'frozen'
         else 'inactive'
    end as status

  scripts/migrate_v3_to_v4.py:118
    # Map legacy status codes to the new status enum.
    # Mapping inherited from the v3 system; do not change without consulting the v3 README.

  models/staging/stg_customer.sql:14
    -- x_legacy_status: preserved from v3 system, mapping in marts/customer.sql
```

This is the evidence the LLM saw when it drafted the description. Useful when an
LLM-generated draft says something surprising — you can verify it's not a
hallucination.

## Tuning the scan

### File extensions

By default `/code-scan` walks `.sql`, `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.go`,
`.java`, `.kt`, `.rs`, `.rb`, `.php`, `.cs`, `.scala`, `.dbt`. Add or restrict via
`~/.amx/config.yml`:

```yaml
code_profiles:
  dbt-prod:
    path: /Users/me/work/dbt-project
    extensions: [".sql", ".py", ".yml"]   # restrict; .yml picks up dbt schema files
    exclude_patterns:
      - "**/.venv/**"
      - "**/node_modules/**"
      - "**/build/**"
      - "**/.dbt/target/**"
active_code_profile: dbt-prod
```

### Cache invalidation

Re-scans are incremental by default. Force a full re-scan when you've changed the
extensions list or exclude patterns:

```text
> /code-scan --rebuild
✓ Cache wiped. Re-scanning from scratch ... (full run, ~45 s)
```

A full re-scan costs the same as the first scan. Use sparingly — most of the time
the incremental path is what you want.

!!! warning "Cache invalidation cost on big repos"
    On a 10k-file monorepo, a full `--rebuild` can take several minutes and cost a few
    cents in embedding API calls. The incremental scan that runs by default touches only
    files changed since the last scan, so a second `/code-scan` after a working day's
    edits typically completes in under a minute.

## Sample config

```yaml
code_profiles:
  dbt-prod:
    path: /Users/me/work/dbt-project
  application:
    path: git@github.com:acme/api-server.git
    extensions: [".py", ".ts"]
    exclude_patterns: ["**/test/**"]
active_code_profile: dbt-prod
```

When multiple profiles are useful (e.g. dbt + application code), only one can be active
at a time; switch with `/use-code <name>`.

## Verify

1. `> /code-scan status` — confirms the most recent scan and the top referenced tables.
2. `> /code-analyze <table>.<column>` — confirms refs are tied to specific lines of code.
3. `> /run <table> --debug` — log lines `[Code] found N references` confirm the agent ran and contributed.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/code-scan` finds 0 references on a repo you know uses these tables | File extensions not in the scan list | Add to `extensions:` (e.g. `.dbt`, `.yml`, `.md`) and `--rebuild` |
| Re-scan is slow even on small edits | Some part of the cache key isn't matching (e.g. case-sensitive filesystem after rename) | `--rebuild` once, then incremental scans should be fast again |
| `/run` says `[Code] skipping (no profile active)` | Profile registered but not activated | `/use-code dbt-prod` |
| Evidence cites the wrong column (looks like noise) | Common substrings (e.g. `id`, `name`) collide across tables | Increase `code_min_relevance` in the YAML to filter low-relevance hits |
| `/code-scan` clones a Git URL but pulls fail later | The cache dir is read-only or the credential expired | `rm -rf ~/.amx/code-cache/<profile>` and re-scan with fresh creds |
| `OutOfMemory` during embedding | Repo is huge (50k+ files) and the embedding batch is too big | Lower `code_embed_batch_size` in YAML to 32 |
