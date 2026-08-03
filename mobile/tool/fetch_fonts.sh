#!/usr/bin/env bash
#
# Download the five families the app uses into assets/fonts/, for a fully
# offline build. Only needed if you want no first-run font download at all —
# by default the app loads them through the `google_fonts` package, which
# caches each family on the device after one online launch.
#
# After running this:
#   1. uncomment the `fonts:` block in pubspec.yaml
#   2. set kUseBundledFonts = true in lib/core/theme/app_theme.dart
#   3. flutter pub get && flutter run
#
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p assets/fonts
cd assets/fonts

BASE="https://raw.githubusercontent.com/google/fonts/main"

fetch() {
  local url="$1" out="$2"
  if [ -f "$out" ]; then
    echo "  ✓ $out (already present)"
    return
  fi
  echo "  ↓ $out"
  curl -fsSL "$url" -o "$out"
}

echo "Fetching fonts into $(pwd)"

fetch "$BASE/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf" DMSerifDisplay-Regular.ttf

# DM Sans, Cinzel, Fraunces and Manrope ship as variable fonts upstream. Static
# instances are what pubspec weight entries expect, so pull them from the
# static/ directories where the repository provides them.
for w in Regular Medium SemiBold Bold; do
  fetch "$BASE/ofl/dmsans/static/DMSans-$w.ttf" "DMSans-$w.ttf"
done
for w in Regular SemiBold Bold; do
  fetch "$BASE/ofl/cinzel/static/Cinzel-$w.ttf" "Cinzel-$w.ttf"
  fetch "$BASE/ofl/fraunces/static/Fraunces_9pt-$w.ttf" "Fraunces-$w.ttf"
done
for w in Regular Medium SemiBold Bold; do
  fetch "$BASE/ofl/manrope/static/Manrope-$w.ttf" "Manrope-$w.ttf"
done

echo
echo "Done. Now uncomment the fonts: block in pubspec.yaml and set"
echo "kUseBundledFonts = true in lib/core/theme/app_theme.dart."
