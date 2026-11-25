#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/check-commit-msg-test.bash

Runs git/hooks/commit-msg against messages it must accept and messages it
must reject, and fails if it gets any of them wrong.
USAGE
  exit 0
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hook="${root}/git/hooks/commit-msg"
message_file="$(mktemp)"
trap 'rm -f "${message_file}"' EXIT
failed=0

expect() {
  local want="$1" name="$2" message="$3" got=0
  printf '%s\n' "${message}" >"${message_file}"
  "${hook}" "${message_file}" >/dev/null 2>&1 || got=$?
  if [[ "${want}" == "accept" && "${got}" -ne 0 ]] || [[ "${want}" == "reject" && "${got}" -eq 0 ]]; then
    echo "commit-msg hook should ${want}: ${name}"
    failed=1
  fi
}

expect accept "a plain message" $'Add the thing\n\nIt does the thing.'
expect accept "a human co-author" $'Add the thing\n\nCo-authored-by: Sam Rivera <sam@example.com>'
expect accept "the word Claude in prose" $'Route employees to Claude models\n\nClaude is one of three providers.'
expect accept "attribution only in a comment line" $'Add the thing\n\n# Co-Authored-By: Claude <noreply@anthropic.com>'
expect reject "a Claude co-author trailer" $'Add the thing\n\nCo-Authored-By: Claude <someone@example.com>'
expect reject "an Anthropic address" $'Add the thing\n\nco-authored-by: Bot <noreply@anthropic.com>'
expect reject "the generated-with footer" $'Add the thing\n\nGenerated with [Claude Code](https://claude.com/claude-code)'
expect reject "a session link" $'Add the thing\n\nClaude-Session: https://claude.ai/code/session_abc'

if [[ "${failed}" -ne 0 ]]; then
  echo "Fix git/hooks/commit-msg so it matches the cases above."
  exit 1
fi
echo "commit-msg hook: 8 cases behave as expected"
