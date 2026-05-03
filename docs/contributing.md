# Contributing

Thanks for considering a contribution. AMX is an open-source CLI for AI-driven database
metadata extraction. This page is the entry point — it covers the development setup,
branching, commit message format, and release process.

The full long-form contributor guide also lives in the [AMX repo's CONTRIBUTING.md](https://github.com/omeryasirkucuk/amx/blob/main/CONTRIBUTING.md);
this page mirrors it for readability and discoverability.

## Development setup

```bash
git clone https://github.com/omeryasirkucuk/amx.git
cd amx
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,code-intel,postgresql]"
pre-commit install
```

A local PostgreSQL is convenient for end-to-end testing:

```bash
docker compose up -d
```

This starts a Postgres on `localhost:5432`. Credentials are dev-only and live in
`docker-compose.yml`; do not reuse them anywhere.

## Branching and pull requests

- `main` is the release branch and is **protected**. Direct pushes are not allowed.
- Create a short-lived feature branch off `main`: `feat/setup-wizard`,
  `fix/snowflake-comment-fetch`, etc.
- Open a pull request when ready. CI must pass and at least one approving review is
  required (you can self-approve when working solo, but the review still gets recorded).

## Commit message format

We use [Conventional Commits](https://www.conventionalcommits.org/) so that releases and
the changelog are generated automatically. The PR title becomes the merge commit subject
and drives the version bump:

| Prefix | Effect on version | Example |
|---|---|---|
| `feat:` | minor | `feat(search): add OpenAI embedding provider` |
| `fix:` | patch | `fix(db): surface snowflake auth error` |
| `perf:` | patch | `perf(rag): batch chunk encoding` |
| `refactor:` | no bump | `refactor(cli): split db commands` |
| `docs:` | no bump | `docs: add embeddings guide` |
| `test:` | no bump | `test: cover bigquery adapter` |
| `chore:` | no bump | `chore: bump pre-commit pin` |
| `ci:` | no bump | `ci: cache pip wheels` |
| `build:` | no bump | `build: drop python 3.9 support` |

A `BREAKING CHANGE:` footer (or `feat!:` / `fix!:`) triggers a major bump.

## Tests

```bash
pytest -ra                                          # run everything (excluding integration/live)
pytest -m "not slow"                                # skip slow tests
pytest tests/test_search_catalog.py -k embedding    # narrow scope
pytest -m "integration or live"                     # opt-in to slow / real-endpoint tests
pytest -m ""                                        # ignore the default filter and run everything
```

The suite uses `unittest.mock`. LLM and DB calls are mocked. Real-endpoint tests live
behind the `integration` and `live` markers and are not run by default.

## Lint, format, type check

```bash
ruff check amx tests
ruff format amx tests
mypy amx
```

Pre-commit runs the lint and format hooks automatically on `git commit`. If you skipped
install, run `pre-commit run --all-files` before pushing.

## Adding dependencies

Add runtime deps to `[project.dependencies]` in `pyproject.toml`. Put dev-only tooling
under `[project.optional-dependencies].dev`. Pin to a sensible lower bound (`>=X.Y`); avoid
upper caps unless we hit a known incompatibility.

Database drivers go under their own backend-named extra (`postgresql`, `snowflake`, …) so
the default install stays lean — see [pyproject.toml](https://github.com/omeryasirkucuk/amx/blob/main/pyproject.toml)
for the existing pattern.

## Releasing

Releases are automated via
[`python-semantic-release`](https://python-semantic-release.readthedocs.io/). Cutting a
release is a single tag push from `main`:

```bash
git tag v0.12.1
git push origin v0.12.1
```

The `release.yml` workflow then:

1. Builds the wheel.
2. Publishes to PyPI via OIDC Trusted Publisher (no API token in the repo).
3. Creates a GitHub Release with the changelog excerpt for that version.

Version numbers are derived from Conventional Commits — `feat:` bumps minor, `fix:` /
`perf:` bump patch, `feat!:` bumps major.

## Reporting bugs

Open an issue at <https://github.com/omeryasirkucuk/amx/issues>. Please include:

- AMX version (`amx --version`).
- Python version and OS.
- Steps to reproduce.
- Relevant excerpts from `~/.amx/logs/amx.log` (redact secrets).
- For DB connector bugs: backend, auth method, and the actionable error AMX printed (not
  the full traceback unless asked).

## Documentation

This documentation site lives in a separate repo:
[omeryasirkucuk/amx-docs](https://github.com/omeryasirkucuk/amx-docs). Edit Markdown
under `docs/`, push to `main`, and the GitHub Action publishes to
<https://omeryasirkucuk.github.io/amx/>.

For local preview:

```bash
git clone https://github.com/omeryasirkucuk/amx-docs.git
cd amx-docs
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

The site is served at <http://127.0.0.1:8000/amx/>.

## Security

Do **not** open public issues for security problems. See [Security](security.md) for the
disclosure process.
