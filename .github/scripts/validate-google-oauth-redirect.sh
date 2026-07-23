#!/usr/bin/env bash
set -euo pipefail

location="${1:-}"
expected_redirect_uri="${2:-}"
require_state="${3:-true}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ -z "$location" ]; then
  fail "redirect location is empty"
fi

if [ -z "$expected_redirect_uri" ]; then
  fail "expected redirect URI is empty"
fi

if [ "$require_state" != true ] && [ "$require_state" != false ]; then
  fail "require_state must be true or false"
fi

if [[ "$location" != https://accounts.google.com/* ]]; then
  fail "redirect host is not Google"
fi

query="${location#*\?}"
if [ "$query" = "$location" ]; then
  fail "redirect query string is missing"
fi

query_parameter() {
  local key="$1"
  local pair
  local -a pairs

  IFS='&' read -r -a pairs <<< "$query"
  for pair in "${pairs[@]}"; do
    if [[ "$pair" == "$key="* ]]; then
      printf '%s' "${pair#*=}"
      return 0
    fi
  done

  return 1
}

client_id="$(query_parameter client_id || true)"
if [ -z "$client_id" ]; then
  fail "client ID is missing"
fi
if [ "$client_id" = placeholder ]; then
  fail "placeholder client ID is active"
fi

redirect_uri="$(query_parameter redirect_uri || true)"
if [ "$redirect_uri" != "$expected_redirect_uri" ]; then
  fail "production callback is missing"
fi

if [ "$require_state" = true ]; then
  state="$(query_parameter state || true)"
  if [ -z "$state" ]; then
    fail "OAuth state is missing"
  fi
fi
