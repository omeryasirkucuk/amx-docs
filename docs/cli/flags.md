# Common flags

A handful of flags appear on multiple commands. Listing them once here so you don't have to
hunt across the per-command pages.

## Profile overrides

These four flags swap a profile for the duration of one command, without changing the
active profile in `config.yml`:

| Flag | Applies to | Description |
|---|---|---|
| `--db-profile NAME` | `/run`, `/run-apply`, `/code-scan`, `/ingest`, `/inspect`, `/profile`, `/connect` | Use the named DB profile for this command |
| `--llm-profile NAME` | `/run`, `/run-apply`, `/code-analyze`, `/doc-analyze`, `/ask` | Use the named LLM profile |
| `--code-profile NAME` | `/run`, `/run-apply`, `/code-scan`, `/code-analyze` | Use the named codebase profile |
| `--doc-profile NAME` | `/run`, `/run-apply`, `/scan`, `/ingest`, `/doc-analyze` | Use the named document profile |

For repeated use of a non-default profile, prefer `/use-db NAME`, `/use-llm NAME`,
`/use-code NAME`, `/use-doc NAME` so the choice persists.

## Cache invalidation

| Flag | Applies to | Description |
|---|---|---|
| `--code-refresh` | `/run`, `/run-apply`, `/code-scan` | Clear the active code profile's scan cache and `amx_code` semantic chunks before running |
| `--refresh` | `/ingest` | Remove existing chunks whose stored resolved file path or original profile source path matches the files being ingested, then re-upsert |

`--code-refresh` is what to use after the source tree changes. `--refresh` on `/ingest` is
useful when documents have moved or shrunk — without it, stale chunks linger.

## Output formats

For `/history compare` and a few report commands:

| Flag | Description |
|---|---|
| `--csv FILE` | Also write CSV |
| `--md FILE` | Also write markdown |
| `--json FILE` | Also write JSON (stable shape — see [API → on-disk formats](../api/index.md#on-disk-formats)) |

## Apply

| Flag | Applies to | Description |
|---|---|---|
| `--apply` | `/run` | Same as `/run-apply` — skip review and write on accept |
| `--unevaluated-only` | `/history review` | Only revisit columns you previously skipped |

## Scope filters (on `/history compare`)

| Flag | Description |
|---|---|
| `--schema NAME` | Filter to one schema |
| `--table NAME` | Filter to one table |
| `--column NAME` | Filter to one column |
| `--last N` | Compare the last N runs |
| `--command analyze.run\|search.ask\|all` | Filter by command type |
| `--by auto\|llm_profile\|doc_profile\|code_profile\|llm_model\|db_profile` | Group by dimension |
| `--diff` | Word-level highlights vs the leftmost run |

## `/ask` flags

| Flag | Description |
|---|---|
| `--actions` | Prompt before running approved follow-up actions (catalog sync, code-evidence refresh, focused `/run`) |
| `--debug` (alias `--verbose`) | Reveal the planner's Thought Trace and add raw `Score` / `Source` / `Conf` columns |

## TLS

| Flag | Applies to | Description |
|---|---|---|
| `--skip-network` | `amx doctor` | Skip the LLM models endpoint ping and any other network probes |

## Discoverability

```text
/help                  # high-level help
/<namespace>           # surface a namespace's commands and shortcuts
/<command> --help      # per-command flags
amx --help             # top-level shell
amx doctor --help
```

`/help` and per-command help are always the source of truth — this page is a navigation aid.
