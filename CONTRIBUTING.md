# Contributing to amx-docs

This repo is the MkDocs Material source for the AMX documentation site published at https://omeryasirkucuk.github.io/amx/. The built site is deployed to the `gh-pages` branch of the **omeryasirkucuk/amx** repo (cross-repo deploy), so a broken build here breaks the public docs.

For a one-page agent checklist, see `AGENTS.md` at the repo root.

## Development setup

```bash
git clone https://github.com/omeryasirkucuk/amx-docs.git
cd amx-docs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Dependencies are pinned in `requirements.txt` — `mkdocs-material`, `pymdown-extensions`, and `mkdocs-minify-plugin`. No Node.js, no JavaScript build step.

## Local preview

```bash
mkdocs serve
```

Runs a live-reloading dev server at `http://127.0.0.1:8000/amx/`. Edits to `docs/**/*.md`, `mkdocs.yml`, and theme overrides under `overrides/` reload automatically.

## Pre-push gate

Before pushing, run the **same command CI runs**:

```bash
mkdocs build --strict
```

If this fails locally, the deploy will fail. There is no other test suite — this single command is the contract.

## CI guardrails

`.github/workflows/deploy.yml` runs on push to `main`:

1. `pip install -r requirements.txt`
2. `mkdocs build --strict`
3. `mkdocs gh-deploy --force --message "ci deploy <sha>"`

Step 3 pushes to `gh-pages` on the AMX repo using the workflow's `GITHUB_TOKEN`. There is no preview environment; whatever lands on `main` ships on the next deploy.

## Common `--strict` failures

`--strict` upgrades MkDocs warnings to errors. The five repeat offenders:

1. **Orphan page** — a new `docs/**/*.md` file not added to `nav:` in `mkdocs.yml`. Either wire it into the navigation tree or remove it.
2. **Broken link** — `[text](missing-page.md)` or `#dead-anchor`. Anchors are slugified from heading text; renaming a heading invalidates every link to its old anchor.
3. **Snippet path** — `--8<-- "path"` includes are validated (`check_paths: true`). Missing path fails the build.
4. **Missing asset** — image or downloadable referenced from Markdown but not committed under `docs/assets/`.
5. **Stale `nav:` entry** — a page referenced in `mkdocs.yml` but the file was renamed or moved.

## Style

- All content is in **English**. Turkish is acceptable in chat with maintainers; tracked files are English-only.
- Do not describe features with cost-gating language. AMX is OSS — features that consume LLM tokens are `metered` or `consume tokens on the active LLM`. External providers may have a `higher quota tier` or `billing-enabled tier`.
- Code blocks are not executed; copy them carefully and test the command against the current AMX release before merging.
- Don't add agent-attribution lines, co-author trailers, or vendor-named guidance files.

## Adding a new page

1. Create `docs/section/your-page.md`.
2. Add it to the `nav:` tree in `mkdocs.yml` at the right depth.
3. Cross-link from at least one existing page (or it dead-ends).
4. Run `mkdocs build --strict` locally.
5. Open a PR; merge to `main` triggers deploy.

## Reporting problems

Open an issue at https://github.com/omeryasirkucuk/amx-docs/issues with the URL of the offending page, the actual vs. expected content, and (for build failures) the full `mkdocs build --strict` log.
