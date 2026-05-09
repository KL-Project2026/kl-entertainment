#!/usr/bin/env bash
# ----------------------------------------------------------------
# verify-deploy.sh — Post-deploy smoke check for Railway + Vercel
#
# Usage:
#   API_URL=https://api.klproject.com WEB_URL=https://app.klproject.com \
#     ./scripts/verify-deploy.sh
#
# Or pass as args:
#   ./scripts/verify-deploy.sh <api-url> <web-url>
# ----------------------------------------------------------------
set -euo pipefail

API_URL="${1:-${API_URL:-}}"
WEB_URL="${2:-${WEB_URL:-}}"

if [[ -z "$API_URL" || -z "$WEB_URL" ]]; then
  echo "Usage: $0 <api-url> <web-url>" >&2
  echo "  or set API_URL / WEB_URL env vars" >&2
  exit 1
fi

API_URL="${API_URL%/}"
WEB_URL="${WEB_URL%/}"

pass=0
fail=0

check() {
  local name="$1"; shift
  local expected="$1"; shift
  local url="$1"; shift
  local actual
  actual=$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo "000")
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ $name → $actual"
    pass=$((pass + 1))
  else
    echo "  ❌ $name → expected $expected, got $actual ($url)"
    fail=$((fail + 1))
  fi
}

echo "== api-server (Railway) =="
check "healthz"           200 "$API_URL/api/healthz"
check "404 unknown route" 404 "$API_URL/api/__nope__"
check "auth login (POST)" 400 "$API_URL/api/auth/login"

echo
echo "== web-app (Vercel) =="
check "root html"   200 "$WEB_URL/"
check "SPA fallback (deep link)" 200 "$WEB_URL/some/spa/route"
check "static asset cache header" 200 "$WEB_URL/favicon.svg"

echo
echo "== CORS preflight (web → api) =="
cors_status=$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 15 \
  -X OPTIONS \
  -H "Origin: $WEB_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  "$API_URL/api/auth/login" || echo "000")
if [[ "$cors_status" =~ ^20[0-9]$ || "$cors_status" == "204" ]]; then
  echo "  ✅ preflight → $cors_status"
  pass=$((pass + 1))
else
  echo "  ❌ preflight → got $cors_status (expected 2xx)"
  fail=$((fail + 1))
fi

echo
echo "Result: $pass passed, $fail failed"
exit "$fail"
