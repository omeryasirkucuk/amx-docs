# AGENTS.md

Guardrails for any automated agent (or human in a hurry) working on this repo.
Read this **before** the first edit — every blocking GitHub Actions check is documented here.
For longer rationale and human onboarding, see `CONTRIBUTING.md`.

## What this repo is

MkDocs Material docs site. The CI workflow `.github/workflows/deploy.yml` runs `mkdocs build --strict` on every push to `main` and then `mkdocs gh-deploy --force` to publish to the `gh-pages` branch on the **omeryasirkucuk/amx** repo (cross-repo deploy). A broken doc build therefore breaks the public site at https://omeryasirkucuk.github.io/amx/, not just CI.

## Pre-push command

```bash
source .venv/bin/activate    # or your local venv
mkdocs build --strict
```

This is the **same command CI runs**. If it passes locally, CI will pass; if it fails locally, do not push.

For interactive editing, `mkdocs serve` runs a live-reloading dev server at `http://127.0.0.1:8000/amx/`.

## Common `--strict` failures

`mkdocs build --strict` upgrades warnings to errors. The recurring traps:

1. **Orphan page.** A new `docs/**/*.md` file is not referenced from `nav:` in `mkdocs.yml`. Strict mode rejects it. Either add the page to `nav:`, or delete it.
2. **Broken internal link.** `[text](missing-page.md)` or `[text](page.md#missing-anchor)` where the target doesn't exist. Anchor names come from heading slugs; check for typos and renamed headings.
3. **Snippet include path.** `pymdownx.snippets` is configured with `check_paths: true`. A `--8<-- "path/to/file"` directive pointing at a missing path fails the build.
4. **Missing image.** Markdown references `assets/foo.png` but the file isn't committed.
5. **Mermaid syntax error.** Fenced ```` ```mermaid ```` blocks with malformed syntax don't fail at build time *but* render as plain text in production. Preview with `mkdocs serve` before merging.

## Editorial constraints

- **English only** in tracked files. Comments, frontmatter, body, image alt text — all English. Turkish in conversation is fine; in files it is not.
- **No cost-gating language.** AMX is OSS; do not describe features or tiers using language that implies a billing wall. For features that consume LLM tokens, use `metered`, `consumes tokens on the active LLM`, or `incurs token usage`. For external providers, use `higher quota tier` or `billing-enabled tier`.
- **No agent attribution.** Do not add co-author trailers, "generated with" lines, or per-repo files referencing specific AI vendors.
- **Code blocks are not executed.** A copy-paste-able command in docs is the agent's responsibility — verify the command runs against the current AMX version before merging.

## When CI fails

1. Open the deploy run log: `gh run view --log-failed <run-id>` or click the email link.
2. The first `ERROR` line from `mkdocs build --strict` names the file and reason. Match it to one of the patterns above.
3. Reproduce locally with `mkdocs build --strict` (not `mkdocs build` — strict mode is the gate).
4. Fix, re-run, push.

## Out of scope

- No Vale, markdownlint, or spellcheck currently configured. Don't add tooling without a separate request.
- No release tagging in this repo — content ships when `main` is pushed. Versioning lives in the AMX repo.
