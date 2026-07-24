#!/bin/sh
set -eu

BASE_URL="${1:-http://127.0.0.1:3001}"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

request() {
  name="$1"
  path="$2"
  curl --silent --show-error \
    --dump-header "$TEMP_DIR/$name.headers" \
    --output "$TEMP_DIR/$name.body" \
    "$BASE_URL$path"
}

assert_status() {
  name="$1"
  expected="$2"
  actual="$(awk 'NR == 1 { print $2 }' "$TEMP_DIR/$name.headers")"
  if [ "$actual" != "$expected" ]; then
    echo "$name returned HTTP $actual instead of $expected"
    cat "$TEMP_DIR/$name.body"
    exit 1
  fi
}

assert_header() {
  name="$1"
  pattern="$2"
  if ! grep -Eiq "$pattern" "$TEMP_DIR/$name.headers"; then
    echo "$name response headers did not match: $pattern"
    cat "$TEMP_DIR/$name.headers"
    exit 1
  fi
}

assert_body() {
  name="$1"
  pattern="$2"
  if ! grep -Fq "$pattern" "$TEMP_DIR/$name.body"; then
    echo "$name response body did not contain: $pattern"
    cat "$TEMP_DIR/$name.body"
    exit 1
  fi
}

request health /health
assert_status health 200
assert_header health '^Content-Type: application/json'
assert_header health '^Cache-Control: no-store'
assert_body health '"frontend":true'

request root /
assert_status root 200
assert_header root '^Cache-Control: no-cache, no-store, must-revalidate'
assert_body root '<title>ConvoLab | Japanese Date, Time, Money, Counter &amp; Verb Practice Tools</title>'
assert_body root '<link rel="canonical" href="https://convo-lab.com/" />'

request tool /tools/japanese-date
assert_status tool 200
assert_body tool '<title>Japanese Date Practice Tool (Furigana + Audio) | ConvoLab</title>'
assert_body tool '<link rel="canonical" href="https://convo-lab.com/tools/japanese-date" />'

request private /app/study
assert_status private 200
assert_header private '^Cache-Control: no-cache, no-store, must-revalidate'
assert_body private '<title>ConvoLab</title>'
assert_body private '<meta name="robots" content="noindex,nofollow" />'

request missing /definitely-not-a-convolab-route
assert_status missing 200
assert_body missing '<title>Page Not Found | ConvoLab</title>'
assert_body missing '<meta name="robots" content="noindex,nofollow" />'

request legacy /tools/date
assert_status legacy 301
assert_header legacy '^Location: http://[^/]+/tools/japanese-date'

request trailing /tools/japanese-date/
assert_status trailing 308
assert_header trailing '^Location: http://[^/]+/tools/japanese-date'

request index /index.html
assert_status index 308
assert_header index '^Location: http://[^/]+/'

request api /api/legacy
assert_status api 404
assert_header api '^Content-Type: application/json'
assert_body api '{"error":{"message":"Not found"}}'
if grep -Fq '<div id="root"></div>' "$TEMP_DIR/api.body"; then
  echo 'Unknown API route fell through to the SPA'
  exit 1
fi

request media /study-media/retired-file.mp3
assert_status media 404

request internal /__spa/generated-routes.conf
assert_status internal 404

asset_path="$(grep -Eo 'src="/assets/[^"]+' "$TEMP_DIR/root.body" | head -n 1 | cut -d '"' -f 2)"
if [ -z "$asset_path" ]; then
  echo 'Could not discover a built JavaScript asset from the root document'
  exit 1
fi
request asset "$asset_path"
assert_status asset 200
assert_header asset '^Cache-Control: public, max-age=31536000, immutable'

echo 'Static frontend smoke checks passed.'
