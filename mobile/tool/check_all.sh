#!/usr/bin/env bash
# Every check that runs without a Flutter toolchain.
#
# The Dart in this repo is hand-authored — the environment it was written in
# could not reach pub.dev — so these stand in for the parts of `dart analyze`
# that matter, plus two checks a Dart analyzer could never do: the API contract
# against the Next.js routes, and route coverage against the web page tree.
#
# Run from anywhere:  bash mobile/tool/check_all.sh
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 2

failed=0

run() {
  local label="$1"
  shift
  printf '\n\033[1m── %s\033[0m\n' "$label"
  if "$@"; then
    return 0
  fi
  failed=1
}

run "Dart tree"       python3 mobile/tool/check_dart.py
run "API contract"    python3 mobile/tool/check_api_contract.py
run "Route coverage"  python3 mobile/tool/route_coverage.py

# The two generated files must still match their TypeScript sources. Running
# each generator and diffing catches a hand-edit to generated output, and a
# web-side change nobody regenerated for.
printf '\n\033[1m── Generated files\033[0m\n'
python3 mobile/tool/gen_access.py > /dev/null || failed=1
python3 mobile/tool/gen_fundraising.py > /dev/null || failed=1
if git diff --quiet -- \
    mobile/lib/core/access/access_tables.dart \
    mobile/lib/core/fundraising/fundraising_menu.dart; then
  echo "Both generated files are up to date with their TypeScript sources."
else
  echo "Generated files are stale — the generators produced different output."
  echo "Review the diff and commit it:"
  git diff --stat -- \
    mobile/lib/core/access/access_tables.dart \
    mobile/lib/core/fundraising/fundraising_menu.dart
  failed=1
fi

printf '\n'
if [ "$failed" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi
exit "$failed"
