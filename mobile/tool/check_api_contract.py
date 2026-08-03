#!/usr/bin/env python3
"""Check every API call the Flutter app makes against the Next.js routes.

The app talks to ~40 endpoints across the repositories. A wrong verb (POST at
a PATCH-only route) or a path that no longer exists fails at runtime with a
405 or a 404, and nothing else in this repo would catch it — the two sides are
written in different languages and never compile together.

This walks `mobile/lib/**` for `_api.get/post/patch/put/delete('/api/...')`
calls, resolves each path against `src/app/api/**/route.ts`, and reports:

  • a path with no matching route file
  • a verb the matched route does not export

Run from anywhere:  python3 mobile/tool/check_api_contract.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "src/app/api"
MOBILE_LIB = ROOT / "mobile/lib"

# `_api.post('/api/foo/$id/bar', ...)` and the getMap/getList wrappers.
CALL_RE = re.compile(
    r"_api\.(get|getMap|getList|post|patch|put|delete)\(\s*'(/api/[^']*)'"
)

VERB_OF = {
    "get": "GET",
    "getMap": "GET",
    "getList": "GET",
    "post": "POST",
    "patch": "PATCH",
    "put": "PUT",
    "delete": "DELETE",
}


def route_table() -> dict[tuple[str, ...], set[str]]:
    """Every route file, keyed by its path segments, valued by its verbs.

    A dynamic segment `[id]` is stored as the wildcard `*`.
    """
    table: dict[tuple[str, ...], set[str]] = {}
    for route in API_DIR.rglob("route.ts"):
        rel = route.relative_to(API_DIR).parent
        segments = tuple(
            "*" if part.startswith("[") else part for part in rel.parts
        )
        verbs = set(re.findall(r"export async function ([A-Z]+)", route.read_text()))
        table[segments] = verbs
    return table


def call_segments(path: str) -> tuple[str, ...]:
    """`/api/events/$eventId/roles` → ('events', '*', 'roles')."""
    trimmed = path[len("/api/") :].strip("/")
    if not trimmed:
        return ()
    out = []
    for part in trimmed.split("/"):
        # A Dart interpolation is always a dynamic segment.
        out.append("*" if "$" in part else part)
    return tuple(out)


def matches(call: tuple[str, ...], route: tuple[str, ...]) -> bool:
    if len(call) != len(route):
        return False
    for a, b in zip(call, route):
        if b == "*" or a == "*":
            continue
        if a != b:
            return False
    return True


def main() -> int:
    if not API_DIR.exists() or not MOBILE_LIB.exists():
        print("Run this from inside the repository.", file=sys.stderr)
        return 2

    routes = route_table()
    problems: list[str] = []
    checked = 0

    for dart in sorted(MOBILE_LIB.rglob("*.dart")):
        for method, path in CALL_RE.findall(dart.read_text()):
            checked += 1
            verb = VERB_OF[method]
            segments = call_segments(path)
            candidates = [
                (route, verbs)
                for route, verbs in routes.items()
                if matches(segments, route)
            ]
            rel = dart.relative_to(ROOT).as_posix()
            if not candidates:
                problems.append(f"{rel}: {verb} {path} — no route file matches")
                continue
            if not any(verb in verbs for _, verbs in candidates):
                available = sorted(
                    {v for _, verbs in candidates for v in verbs}
                )
                problems.append(
                    f"{rel}: {verb} {path} — route exports "
                    f"{', '.join(available) or 'nothing'}"
                )

    print(f"Checked {checked} API call(s) against {len(routes)} route file(s)")
    if problems:
        print(f"\n{len(problems)} problem(s):\n")
        for problem in sorted(set(problems)):
            print(f"  • {problem}")
        return 1
    print("Every call matches a route that exports its verb.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
