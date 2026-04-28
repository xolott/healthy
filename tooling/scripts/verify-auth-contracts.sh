#!/usr/bin/env bash
# Runs typecheck, lint, and tests for API + admin, then flutter analyze/test for
# shared auth and mobile apps (issue #16 auth verification pass).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== API: typecheck, lint, test =="
pnpm --filter api run typecheck
pnpm --filter api run lint
pnpm --filter api run test

echo "== Admin: typecheck, lint, test =="
pnpm --filter admin run typecheck
pnpm --filter admin run lint
pnpm --filter admin run test

if ! command -v flutter >/dev/null 2>&1; then
  echo "error: flutter is not on PATH; install the Flutter SDK to run the full auth verification pass." >&2
  exit 1
fi

for pkg in packages/healthy_mobile_auth apps/healthy_meals apps/healthy_workouts; do
  echo "== Flutter: $pkg =="
  (cd "$ROOT/$pkg" && flutter analyze && flutter test)
done

echo "Auth contract verification finished successfully."
