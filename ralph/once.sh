#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ralph/once.sh <issue-or-range>...

Examples:
  ralph/once.sh 2 3 4 5 6
  ralph/once.sh 5-10
  ralph/once.sh 2 4-6 9
EOF
}

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 64
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required" >&2
  exit 69
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "error: agent CLI is required" >&2
  exit 69
fi

issues=()

for token in "$@"; do
  if [[ "$token" =~ ^[0-9]+$ ]]; then
    issue=$((10#$token))
    if (( issue < 1 )); then
      echo "error: invalid issue number: $token" >&2
      exit 64
    fi
    issues+=("$issue")
  elif [[ "$token" =~ ^([0-9]+)-([0-9]+)$ ]]; then
    start=$((10#${BASH_REMATCH[1]}))
    end=$((10#${BASH_REMATCH[2]}))

    if (( start < 1 || end < 1 || start > end )); then
      echo "error: invalid issue range: $token" >&2
      exit 64
    fi

    for ((issue = start; issue <= end; issue++)); do
      issues+=("$issue")
    done
  else
    echo "error: invalid issue or range: $token" >&2
    usage >&2
    exit 64
  fi
done

issues=($(printf "%s\n" "${issues[@]}" | sort -n | uniq))
run_issues=()

echo "Validating GitHub issues..."
for issue in "${issues[@]}"; do
  if ! state="$(gh issue view "$issue" --json state --jq '.state')"; then
    echo "error: GitHub issue #$issue does not exist or is not accessible" >&2
    exit 66
  fi

  if [[ "$state" != "OPEN" ]]; then
    echo "error: GitHub issue #$issue is not open" >&2
    exit 66
  fi

  title="$(gh issue view "$issue" --json title --jq '.title')"
  if [[ "$title" == PRD:* ]]; then
    echo "Skipping PRD issue #$issue: $title"
    continue
  fi

  run_issues+=("$issue")
done

if [[ ${#run_issues[@]} -eq 0 ]]; then
  echo "No open non-PRD issues to run."
  exit 0
fi

echo "Running Ralph over ${#run_issues[@]} issue(s)..."
for issue in "${run_issues[@]}"; do
  echo "==> /ralph $issue"
  agent --model composer-2 -p --yolo "/ralph $issue"
done
