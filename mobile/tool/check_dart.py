#!/usr/bin/env python3
"""Static sanity checks for the Dart tree.

`flutter analyze` is the real check and must be run on a machine with the SDK.
This catches the classes of mistake that are easy to make when hand-authoring a
large tree and expensive to discover only at build time:

  1. a relative import that points at a file that does not exist
  2. a reference to AppIcons.x / IconTone.x that was never declared
  3. unbalanced braces, parens or brackets in a file
  4. a widget referenced by the router that no file defines
  5. duplicate top-level declarations across the tree

Run from anywhere:  python3 mobile/tool/check_dart.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "lib"

problems: list[str] = []


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def strip_noise(src: str) -> str:
    """Blank out comments and string literals, but KEEP the code inside
    `${...}` interpolations — that code contains real parentheses that the
    delimiter check must see, and it can reference AppIcons/AppColors.

    A raw string (r'...') has no interpolation, so its body is dropped whole.
    """
    out: list[str] = []
    i, n = 0, len(src)

    def skip_string(start: int, quote: str, raw: bool) -> int:
        """Consume a string starting after its opening quote, emitting any
        interpolated code. Returns the index just past the closing quote."""
        j = start
        triple = len(quote) == 3
        while j < n:
            if src.startswith(quote, j):
                return j + len(quote)
            if src[j] == "\\":
                j += 2
                continue
            if not triple and src[j] == "\n":
                # Unterminated single-line string; bail rather than run away.
                return j
            if not raw and src.startswith("${", j):
                # Emit the interpolated expression as code, tracking brace
                # depth so nested maps/closures inside it are handled.
                j += 2
                depth = 1
                expr_start = j
                while j < n and depth > 0:
                    if src[j] == "{":
                        depth += 1
                    elif src[j] == "}":
                        depth -= 1
                        if depth == 0:
                            break
                    j += 1
                out.append(" " + src[expr_start:j] + " ")
                j += 1  # past the closing }
                continue
            j += 1
        return j

    while i < n:
        c = src[i]
        # Line comment
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        # Block comment
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue
        # A raw-string prefix immediately before a quote.
        raw = c == "r" and i + 1 < n and src[i + 1] in "'\""
        if raw:
            i += 1
            c = src[i]
        # Triple-quoted string
        if src.startswith("'''", i) or src.startswith('"""', i):
            quote = src[i : i + 3]
            out.append('""')
            i = skip_string(i + 3, quote, raw)
            continue
        # Single- or double-quoted string
        if c in "'\"":
            out.append('""')
            i = skip_string(i + 1, c, raw)
            continue
        out.append(c)
        i += 1
    return "".join(out)


dart_files = sorted(LIB.rglob("*.dart"))
if not dart_files:
    sys.exit("No Dart files found under mobile/lib")

sources = {f: f.read_text() for f in dart_files}
clean = {f: strip_noise(s) for f, s in sources.items()}

# ── 1. Relative imports resolve ──────────────────────────────────────────────
IMPORT_RE = re.compile(r"""^\s*(?:import|export)\s+'([^']+)'""", re.M)
for f, src in sources.items():
    for target in IMPORT_RE.findall(src):
        if target.startswith(("package:", "dart:")):
            continue
        resolved = (f.parent / target).resolve()
        if not resolved.exists():
            problems.append(f"{rel(f)}: import '{target}' does not resolve")

# ── 2. AppIcons / IconTone members exist ─────────────────────────────────────
def declared_members(path: Path, pattern: str) -> set[str]:
    if not path.exists():
        return set()
    return set(re.findall(pattern, path.read_text(), re.M))


icons_file = LIB / "core/theme/app_icons.dart"
icon_names = declared_members(
    icons_file, r"^\s*static const (?:IconData )?(\w+)\s*=",
) | declared_members(icons_file, r"^\s*static IconData (\w+)\(")

tones_file = LIB / "core/theme/icon_tones.dart"
tone_names = set()
if tones_file.exists():
    body = re.search(r"enum IconTone \{(.*?)\}", tones_file.read_text(), re.S)
    if body:
        tone_names = {m.strip() for m in body.group(1).replace("\n", "").split(",") if m.strip()}

colors_file = LIB / "core/theme/app_colors.dart"
color_names = declared_members(colors_file, r"^\s*static const (\w+) =") | declared_members(
    colors_file, r"^\s*static List<BoxShadow> get (\w+)"
)

for label, table in (
    ("AppIcons", icon_names),
    ("IconTone", tone_names),
    ("AppColors", color_names),
):
    if not table:
        problems.append(
            f"symbol table for {label} came back empty — the checker would "
            f"silently pass; fix the extractor in {rel(Path(__file__))}"
        )

for f, src in clean.items():
    for name in set(re.findall(r"\bAppIcons\.(\w+)", src)):
        if icon_names and name not in icon_names:
            problems.append(f"{rel(f)}: AppIcons.{name} is not declared")
    for name in set(re.findall(r"\bIconTone\.(\w+)", src)):
        if tone_names and name not in tone_names and name != "values":
            problems.append(f"{rel(f)}: IconTone.{name} is not declared")
    for name in set(re.findall(r"\bAppColors\.(\w+)", src)):
        if color_names and name not in color_names:
            problems.append(f"{rel(f)}: AppColors.{name} is not declared")

# ── 3. Balanced delimiters ───────────────────────────────────────────────────
PAIRS = {"}": "{", ")": "(", "]": "["}
for f, src in clean.items():
    stack: list[str] = []
    for ch in src:
        if ch in "{([":
            stack.append(ch)
        elif ch in PAIRS:
            if not stack or stack[-1] != PAIRS[ch]:
                problems.append(f"{rel(f)}: unbalanced '{ch}'")
                stack = []
                break
            stack.pop()
    if stack:
        problems.append(f"{rel(f)}: {len(stack)} unclosed '{stack[-1]}'")

# ── 4. Every class the router builds exists somewhere ────────────────────────
DECL_RE = re.compile(r"^\s*(?:abstract\s+(?:final\s+)?|final\s+|sealed\s+|mixin\s+)?(?:class|enum|typedef|extension)\s+(\w+)", re.M)
declared_types: dict[str, list[Path]] = {}
for f, src in sources.items():
    for name in DECL_RE.findall(src):
        declared_types.setdefault(name, []).append(f)

router_files = [LIB / "core/router/app_router.dart", LIB / "core/router/routes.dart"]
for rf in router_files:
    if not rf.exists():
        continue
    body = clean[rf]
    for name in set(re.findall(r"const (\w+Screen)\(", body)):
        if name not in declared_types:
            problems.append(f"{rel(rf)}: {name} is referenced but never declared")

# ── 5. Duplicate top-level declarations ──────────────────────────────────────
for name, files in declared_types.items():
    # Private names may legitimately repeat across files.
    if name.startswith("_"):
        continue
    if len(files) > 1:
        where = ", ".join(rel(p) for p in files)
        problems.append(f"duplicate declaration of {name}: {where}")

# ── 6. Providers referenced but never declared ───────────────────────────────
provider_decls = set()
for f, src in sources.items():
    provider_decls |= set(re.findall(r"^final (\w+Provider)\s*=", src, re.M))
for f, src in clean.items():
    for name in set(re.findall(r"\b(?:watch|read|listen|invalidate|refresh)\((\w+Provider)\b", src)):
        if name not in provider_decls:
            problems.append(f"{rel(f)}: {name} is used but never declared")

# ── Report ───────────────────────────────────────────────────────────────────
print(f"Checked {len(dart_files)} Dart files under {rel(LIB)}")
if problems:
    print(f"\n{len(problems)} problem(s):\n")
    for p in sorted(set(problems)):
        print(f"  • {p}")
    sys.exit(1)
print("No problems found.")
