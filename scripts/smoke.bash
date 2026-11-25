#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  cat <<'USAGE'
Usage: scripts/smoke.bash <base-url> [expected-version]

Probes a running Company Sim started with APP_PASSWORD=$SMOKE_PASSWORD
(default "smoke") and fails on the first thing that is wrong:

  1. /healthz answers 200 without credentials, with the expected version.
  2. / answers 401 without credentials.
  3. / serves the built UI with credentials.
  4. /api/chat rejects an unknown provider.
USAGE
  exit 0
fi

base="${1%/}"
expected="${2:-}"
password="${SMOKE_PASSWORD:-smoke}"

fail() {
  echo "smoke: $1"
  exit 1
}

status() {
  curl --silent --output /dev/null --write-out '%{http_code}' --noproxy '*' --max-time 10 "$@" || true
}

for attempt in $(seq 1 30); do
  if [[ "$(status "${base}/healthz")" == "200" ]]; then
    break
  fi
  if [[ "${attempt}" -eq 30 ]]; then
    fail "${base}/healthz did not answer 200 within 30 seconds. Is the server running?"
  fi
  sleep 1
done

health="$(curl --silent --noproxy '*' --max-time 10 "${base}/healthz")"
if [[ -n "${expected}" && "${health}" != *"\"version\":\"${expected}\""* ]]; then
  fail "expected version ${expected}, got ${health}"
fi

[[ "$(status "${base}/")" == "401" ]] || fail "/ should answer 401 without credentials"
[[ "$(status "${base}/api/health")" == "401" ]] || fail "/api/health should answer 401 without credentials"

page="$(curl --silent --noproxy '*' --max-time 10 --user "ceo:${password}" "${base}/")"
[[ "${page}" == *'<div id="root">'* ]] || fail "/ did not serve the built UI. Was 'make build' run?"

bad="$(status --user "ceo:${password}" --header 'content-type: application/json' \
  --data '{"provider":"nope","model":"m","prompt":"p"}' "${base}/api/chat")"
[[ "${bad}" == "400" ]] || fail "/api/chat should reject an unknown provider with 400, got ${bad}"

echo "smoke: ${base} is healthy (${health})"
