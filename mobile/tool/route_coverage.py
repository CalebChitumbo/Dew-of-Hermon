#!/usr/bin/env python3
"""Compare every Next.js page route against the Flutter router.

The mobile app is a port, so a web URL with no Flutter counterpart is either
work still to do or a deliberate omission. This prints both directions so
neither can drift silently.

Run from anywhere:  python3 mobile/tool/route_coverage.py
Exits non-zero when a web route has no mobile counterpart and is not listed
in EXPECTED_ABSENT below.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_APP = ROOT / "src/app"
ROUTES = ROOT / "mobile/lib/core/router/routes.dart"

# Routes that exist on the web but deliberately have no mobile screen.
EXPECTED_ABSENT = {
    # The marketing landing page. On mobile the app opens on the dashboard,
    # or on /login when signed out.
    "/",
    # A dev-only database seeding page.
    "/seed",
}

# Screens the shell router owns rather than featureRoutes.
SHELL_ROUTES = {
    "/login",
    "/register",
    "/forgot-password",
    "/splash",
    "/dashboard",
    "/profile",
    "/notifications",
}


def web_routes() -> set[str]:
    out: set[str] = set()
    for page in WEB_APP.rglob("page.tsx"):
        rel = page.relative_to(WEB_APP).parent.as_posix()
        route = "/" if rel == "." else f"/{rel}"
        # Next.js route groups — `(auth)` — are not part of the URL.
        route = re.sub(r"/\([^)]*\)", "", route) or "/"
        out.add(route)
    return out


def mobile_routes() -> set[str]:
    """Walk the nested GoRoute tree, joining child paths onto their parent."""
    src = ROUTES.read_text()
    out: set[str] = set()
    stack: list[tuple[str, int]] = []  # (full path, paren depth at open)
    depth = 0
    i = 0
    pattern = re.compile(r"GoRoute\(\s*path:\s*'([^']*)'")

    while i < len(src):
        match = pattern.match(src, i)
        if match:
            raw = match.group(1)
            parent = stack[-1][0] if stack else ""
            full = raw if raw.startswith("/") else f"{parent}/{raw}"
            out.add(full)
            # Account for every paren inside the matched span, including
            # GoRoute's own opening one.
            depth += match.group(0).count("(") - match.group(0).count(")")
            stack.append((full, depth))
            i = match.end()
            continue

        char = src[i]
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            while stack and stack[-1][1] > depth:
                stack.pop()
        i += 1

    return out | SHELL_ROUTES


def normalise(route: str) -> str:
    """`[eventId]` and `:id` name the same route."""
    route = re.sub(r"\[[^\]]+\]", ":id", route)
    route = re.sub(r":[A-Za-z][A-Za-z0-9]*", ":id", route)
    return route


def main() -> int:
    if not WEB_APP.exists() or not ROUTES.exists():
        print("Run this from inside the repository.", file=sys.stderr)
        return 2

    web = {normalise(r) for r in web_routes()}
    mobile = {normalise(r) for r in mobile_routes()}
    absent = {normalise(r) for r in EXPECTED_ABSENT}

    missing = sorted(web - mobile - absent)
    extra = sorted(mobile - web - {normalise(r) for r in SHELL_ROUTES})

    print(f"{len(web)} web routes, {len(mobile)} mobile routes")

    if missing:
        print(f"\n{len(missing)} web route(s) with no mobile screen:")
        for route in missing:
            print(f"  • {route}")
    else:
        print("\nEvery web route has a mobile screen.")

    if extra:
        print(f"\n{len(extra)} mobile route(s) with no web page:")
        for route in extra:
            print(f"  • {route}")

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
