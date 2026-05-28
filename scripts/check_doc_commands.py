#!/usr/bin/env python3
"""Guard against documentation drift for renamed / nonexistent AMX commands.

A command rename (scan/ingest/refresh/generate -> /index, /code-index, /run)
once left ~8 doc pages teaching commands that no longer exist, so a new user
following the quickstart hit "Unknown command" on the first value-adding step.
This guard fails CI if any of those dead commands, flags, or fabricated
features reappears in the docs, so the next rename can't silently rot them.

It is intentionally a denylist (not a full registry cross-check): it has zero
external dependencies and zero false positives on the real command surface.
When a command is genuinely renamed again, update both the docs and the
DEAD_TOKENS / CONTEXT_TOKENS tables here in the same change.

Run:  python scripts/check_doc_commands.py
Exits non-zero (listing every offending file:line) when drift is found.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"

# Always-wrong tokens: these have NO legitimate context anywhere in the docs.
# (key = human label, value = compiled regex)
DEAD_TOKENS: dict[str, re.Pattern[str]] = {
    "/db inspect (use /inspect)": re.compile(r"/db\s+inspect\b"),
    "/db profiling-mode (use /profiling)": re.compile(r"/db\s+profiling-mode\b"),
    "/db cache clear (use /cache-clear)": re.compile(r"/db\s+cache\s+clear\b"),
    "/code-scan (use /code-index)": re.compile(r"/code-scan\b"),
    "/code-refresh (use /code-index)": re.compile(r"/code-refresh\b"),
    "/code-analyze (use /code-results)": re.compile(r"/code-analyze\b"),
    "--review-all (no such flag)": re.compile(r"--review-all\b"),
    "--auto-accept-high (no such flag)": re.compile(r"--auto-accept-high\b"),
    "max_bytes_billed (not a feature)": re.compile(r"max_bytes_billed"),
    "AMX_HOME (use AMX_CONFIG_DIR)": re.compile(r"\bAMX_HOME\b"),
    "ConfigSchemaTooOldError (does not exist)": re.compile(r"ConfigSchemaTooOldError"),
    ".amxsession (no such file; use /session)": re.compile(r"\.amxsession\b"),
}

# Context-sensitive tokens: the dead *command* form is wrong, but the token
# also appears legitimately (a REST path like /api/.../ingest, or a line that
# explicitly documents the command's *absence*). Match only the command form
# and skip lines that are clearly an API path or an absence note.
CONTEXT_TOKENS: dict[str, re.Pattern[str]] = {
    "/scan (use /index)": re.compile(r"(?<![\w/])/scan(?![\w/-])"),
    "/ingest (use /index)": re.compile(r"(?<![\w/])/ingest(?![\w/-])"),
    "/generate (use /run)": re.compile(r"(?<![\w/])/generate(?![\w/-])"),
    "--profiling-mode (no such flag; use /profiling)": re.compile(r"--profiling-mode\b"),
}

# A CONTEXT_TOKENS hit on a line containing any of these is legitimate
# (the docs are referencing a REST endpoint or stating the command is gone).
_ALLOWED_CONTEXT = re.compile(
    r"/api/|does not|doesn't|do not|don't|no longer|not a |not exist|"
    r"removed|deprecated|instead|isn't|aren't|n't expose|no `",
    re.IGNORECASE,
)


# Changelogs legitimately record removed/renamed commands by name — their job
# is to describe history, so they're not held to the current-command surface.
_EXCLUDED_FILES = {"changelog.md"}


def _iter_violations() -> list[tuple[Path, int, str, str]]:
    out: list[tuple[Path, int, str, str]] = []
    for md in sorted(DOCS_DIR.rglob("*.md")):
        if md.name.lower() in _EXCLUDED_FILES:
            continue
        for lineno, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            for label, pat in DEAD_TOKENS.items():
                if pat.search(line):
                    out.append((md, lineno, label, line.strip()))
            if not _ALLOWED_CONTEXT.search(line):
                for label, pat in CONTEXT_TOKENS.items():
                    if pat.search(line):
                        out.append((md, lineno, label, line.strip()))
    return out


def main() -> int:
    if not DOCS_DIR.is_dir():
        print(f"docs dir not found: {DOCS_DIR}", file=sys.stderr)
        return 2
    violations = _iter_violations()
    if not violations:
        print("doc-command check: OK — no renamed/nonexistent commands found.")
        return 0
    print(f"doc-command check: {len(violations)} drift hit(s) found:\n", file=sys.stderr)
    for md, lineno, label, text in violations:
        rel = md.relative_to(DOCS_DIR.parent)
        print(f"  {rel}:{lineno}  [{label}]\n      {text}", file=sys.stderr)
    print(
        "\nThese commands/flags/features were renamed or never existed. "
        "Fix the docs to the real command surface (see this script's tables).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
