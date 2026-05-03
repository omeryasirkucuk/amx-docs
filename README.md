# amx-docs

Source for the [AMX documentation site](https://omeryasirkucuk.github.io/amx/).

The product itself lives at [omeryasirkucuk/amx](https://github.com/omeryasirkucuk/amx). This
repo contains only the docs site sources (Markdown + [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
config). Each push to `main` builds the site and publishes it to the `gh-pages` branch of the
`amx` repo via the workflow in `.github/workflows/deploy.yml`.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

The site is served at <http://127.0.0.1:8000/amx/>. Live reload is enabled — edit a Markdown
file under `docs/` and the browser refreshes automatically.

## Building

```bash
mkdocs build --strict
```

`--strict` turns broken internal links and missing nav entries into hard errors. CI runs the
same command, so reproduce locally before pushing.

## Project layout

```
docs/                 # all Markdown sources, organised by section
overrides/            # MkDocs Material theme overrides (custom partials)
mkdocs.yml            # site config and navigation
requirements.txt      # docs build deps
.github/workflows/    # GitHub Actions: build + cross-repo deploy
```

## Deploying

Pushes to `main` trigger `.github/workflows/deploy.yml` which:

1. Checks out this repo and `omeryasirkucuk/amx`.
2. Builds the site with `mkdocs build --strict`.
3. Pushes the built `site/` to the `gh-pages` branch of `omeryasirkucuk/amx` using a deploy
   key stored in the `AMX_PAGES_DEPLOY_KEY` secret.

GitHub Pages on the `amx` repo is configured to serve from that branch, so the URL stays
`https://omeryasirkucuk.github.io/amx/`.

See [`docs/contributing.md`](docs/contributing.md) for the full contribution workflow.

## License

Apache-2.0 — same as the AMX project.
