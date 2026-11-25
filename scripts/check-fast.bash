#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/check-fast.bash

Checks only the files staged for commit: Prettier formatting, ESLint on
TypeScript, and cspell. Exits 0 when nothing is staged or everything passes.
On failure it names the fix. `make check` is the full gate that CI runs.
USAGE
  exit 0
fi

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${root}" ]]; then
  echo "check/fast: not a git repository. Run it from a checkout."
  exit 1
fi
cd "${root}"

mapfile -d '' -t staged < <(git diff --cached --name-only --diff-filter=ACMRT -z)
existing=()
for file in "${staged[@]}"; do
  if [[ -f "${file}" ]]; then
    existing+=("${file}")
  fi
done
if [[ "${#existing[@]}" -eq 0 ]]; then
  echo "check/fast: nothing staged."
  exit 0
fi

code=()
for file in "${existing[@]}"; do
  case "${file}" in
    *.ts | *.tsx | *.js) code+=("${file}") ;;
  esac
done

bin="${root}/node_modules/.bin"
failed=0

if ! "${bin}/prettier" --check --ignore-unknown --log-level warn "${existing[@]}"; then
  echo "check/fast: formatting is off. Run 'make format' and stage the result."
  failed=1
fi

if [[ "${#code[@]}" -gt 0 ]] && ! "${bin}/eslint" --max-warnings 0 "${code[@]}"; then
  echo "check/fast: lint failed. Fix the findings above (some are fixable with 'npx eslint --fix')."
  failed=1
fi

if ! "${bin}/cspell" --no-progress --no-summary --no-must-find-files --config cspell.json "${existing[@]}"; then
  echo "check/fast: unknown words. Correct them or add them to cspell.json."
  failed=1
fi

exit "${failed}"
