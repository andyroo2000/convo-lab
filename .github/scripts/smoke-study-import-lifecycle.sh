#!/usr/bin/env bash

set -euo pipefail

: "${ACTIVE_COLOR:?ACTIVE_COLOR is required}"
: "${ORIGINAL_PROXY_EMAIL:?ORIGINAL_PROXY_EMAIL is required}"
: "${ORIGINAL_PROXY_TOKEN:?ORIGINAL_PROXY_TOKEN is required}"

COMPOSE="docker compose -p convolab-prod -f docker-compose.prod.yml --env-file .env.production"
SERVER_CONTAINER="convolab-server-$ACTIVE_COLOR"
ARCHIVE_DIR=""
ARCHIVE_PATH=""
CSRF_COOKIE_JAR=""
SMOKE_EMAIL=""

upsert_env() {
  local key="$1"
  local value="$2"
  local escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//#/\\#}"
  escaped_value="${escaped_value//&/\\&}"

  if grep -q "^${key}=" .env.production; then
    sed -i "s#^${key}=.*#${key}=${escaped_value}#" .env.production
  else
    printf '%s=%s\n' "$key" "$value" >> .env.production
  fi
}

wait_for_health() {
  local container="$1"
  local attempt
  local status

  for attempt in {1..60}; do
    status="$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo missing)"
    if [ "$status" = healthy ]; then
      return 0
    fi
    if [ "$status" = unhealthy ] || [ "$status" = missing ] || [ -z "$status" ]; then
      docker logs --tail=200 "$container" || true
      return 1
    fi
    sleep 5
  done

  docker logs --tail=200 "$container" || true
  return 1
}

delete_learning_os_smoke_user() {
  [ -n "$SMOKE_EMAIL" ] || return 0

  # The single-quoted program is PHP; its dollar expressions must not expand in Bash.
  # shellcheck disable=SC2016
  $COMPOSE run --rm -T --no-deps -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os \
    php artisan tinker --execute='
      $user = App\Models\User::query()->where("email", getenv("IMPORT_SMOKE_EMAIL"))->first();
      if ($user !== null) {
          $jobs = App\Domain\Study\Models\StudyImportJob::query()
              ->where("user_id", $user->getKey())
              ->get();
          foreach ($jobs as $job) {
              if (is_string($job->source_object_path)) {
                  Illuminate\Support\Facades\Storage::disk("study-imports")
                      ->delete($job->source_object_path);
              }
              Illuminate\Support\Facades\Storage::disk(
                  App\Domain\Media\Models\MediaAsset::DISK_MEDIA
              )->deleteDirectory("study/imports/".$job->getKey());
          }
          $user->delete();
          if (App\Models\User::query()->where("email", getenv("IMPORT_SMOKE_EMAIL"))->exists()) {
              throw new RuntimeException("Learning OS import smoke user was not deleted.");
          }
      }
    ' < /dev/null >/dev/null
}

delete_convolab_smoke_user() {
  [ -n "$SMOKE_EMAIL" ] || return 0

  docker exec -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" "$SERVER_CONTAINER" \
    node --input-type=module --eval='
      import { PrismaClient } from "@prisma/client";
      const prisma = new PrismaClient();
      try {
        await prisma.user.deleteMany({ where: { email: process.env.IMPORT_SMOKE_EMAIL } });
        const remaining = await prisma.user.count({
          where: { email: process.env.IMPORT_SMOKE_EMAIL },
        });
        if (remaining !== 0) throw new Error("ConvoLab import smoke user was not deleted.");
      } finally {
        await prisma.$disconnect();
      }
    ' >/dev/null
}

restore_proxy_identity() {
  upsert_env LEARNING_OS_PROXY_USER_EMAIL "$ORIGINAL_PROXY_EMAIL"
  upsert_env LEARNING_OS_API_TOKEN "$ORIGINAL_PROXY_TOKEN"
  $COMPOSE up -d --no-deps --force-recreate "server-$ACTIVE_COLOR" >/dev/null
  wait_for_health "$SERVER_CONTAINER"
}

cleanup() {
  local exit_status=$?
  local cleanup_status=0
  trap - EXIT
  set +e

  delete_learning_os_smoke_user || cleanup_status=1
  delete_convolab_smoke_user || cleanup_status=1
  if [ -n "$ARCHIVE_DIR" ]; then
    rm -rf "$ARCHIVE_DIR" || cleanup_status=1
  fi
  if [ -n "$CSRF_COOKIE_JAR" ]; then
    rm -f "$CSRF_COOKIE_JAR" || cleanup_status=1
  fi
  restore_proxy_identity || cleanup_status=1

  if [ "$exit_status" -eq 0 ] && [ "$cleanup_status" -ne 0 ]; then
    echo "Import smoke verification passed, but disposable-state cleanup failed." >&2
    exit "$cleanup_status"
  fi
  exit "$exit_status"
}

trap cleanup EXIT

SMOKE_EMAIL="learning-os-import-smoke-$(date -u +%s)-$RANDOM@example.invalid"
ARCHIVE_DIR="$(mktemp -d)"
ARCHIVE_PATH="$ARCHIVE_DIR/deployment-import-smoke.colpkg"

python3 .github/scripts/create-study-import-smoke-archive.py "$ARCHIVE_PATH" >/dev/null
archive_size="$(wc -c < "$ARCHIVE_PATH" | tr -d '[:space:]')"

convolab_user_id="$(docker exec -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" "$SERVER_CONTAINER" \
  node --input-type=module --eval='
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.create({
        data: {
          email: process.env.IMPORT_SMOKE_EMAIL,
          name: "Learning OS import smoke",
          emailVerified: true,
        },
      });
      process.stdout.write(user.id);
    } finally {
      await prisma.$disconnect();
    }
  ')"
test -n "$convolab_user_id"

proxy_token_output="$(docker exec -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
  php artisan tinker --execute='
    $user = App\Models\User::query()->create([
        "name" => "Learning OS import smoke",
        "email" => getenv("IMPORT_SMOKE_EMAIL"),
        "password" => Illuminate\Support\Str::password(32),
    ]);
    echo "IMPORT_SMOKE_TOKEN=".$user
        ->createToken("convolab-import-smoke", ["study:read", "study:write"])
        ->plainTextToken;
  ' < /dev/null)"
proxy_token="$(printf '%s\n' "$proxy_token_output" | sed -n 's/^IMPORT_SMOKE_TOKEN=//p' | tail -1)"
test -n "$proxy_token"
echo "::add-mask::$proxy_token"

upsert_env LEARNING_OS_PROXY_USER_EMAIL "$SMOKE_EMAIL"
upsert_env LEARNING_OS_API_TOKEN "$proxy_token"
$COMPOSE up -d --no-deps --force-recreate "server-$ACTIVE_COLOR" >/dev/null
wait_for_health "$SERVER_CONTAINER"

auth_token="$(docker exec \
  -e AUTH_USER_ID="$convolab_user_id" \
  -e AUTH_USER_ROLE=user \
  "$SERVER_CONTAINER" \
  node --input-type=module --eval='
    import jwt from "jsonwebtoken";
    process.stdout.write(jwt.sign(
      { userId: process.env.AUTH_USER_ID, role: process.env.AUTH_USER_ROLE },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    ));
  ')"
test -n "$auth_token"
echo "::add-mask::$auth_token"

CSRF_COOKIE_JAR="$(mktemp)"
curl --fail --silent --show-error \
  --cookie "token=$auth_token" \
  --cookie-jar "$CSRF_COOKIE_JAR" \
  --header 'Origin: https://convo-lab.com' \
  'https://convo-lab.com/api/auth/csrf' >/dev/null
csrf_cookie_raw="$(awk '$6 == "XSRF-TOKEN" { value = $7 } END { print value }' "$CSRF_COOKIE_JAR")"
rm -f "$CSRF_COOKIE_JAR"
CSRF_COOKIE_JAR=""
test -n "$csrf_cookie_raw"
csrf_token="$(docker exec -e RAW_CSRF_TOKEN="$csrf_cookie_raw" "$SERVER_CONTAINER" \
  node --input-type=module --eval='process.stdout.write(decodeURIComponent(process.env.RAW_CSRF_TOKEN))')"
test -n "$csrf_token"

read_route() {
  curl --fail --silent --show-error \
    --header 'Accept: application/json' \
    --cookie "token=$auth_token" \
    "https://convo-lab.com$1"
}

mutate_route() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local curl_args=(
    --fail --silent --show-error
    --request "$method"
    --header 'Accept: application/json'
    --header 'Content-Type: application/json'
    --header 'Origin: https://convo-lab.com'
    --header "X-CSRF-Token: $csrf_token"
    --header "Cookie: token=$auth_token; XSRF-TOKEN=$csrf_cookie_raw"
  )
  if [ -n "$body" ]; then
    curl_args+=(--data "$body")
  fi
  curl "${curl_args[@]}" "https://convo-lab.com$path"
}

json_field() {
  local expression="$1"
  docker exec -i -e JSON_EXPRESSION="$expression" "$SERVER_CONTAINER" \
    node --input-type=module --eval='
      process.stdin.setEncoding("utf8");
      let input = "";
      for await (const chunk of process.stdin) input += chunk;
      const value = Function("response", `"use strict"; return (${process.env.JSON_EXPRESSION});`)(
        JSON.parse(input)
      );
      if (value === undefined || value === null) process.exit(1);
      process.stdout.write(String(value));
    '
}

readiness="$(read_route '/api/learning-os/study/imports/readiness')"
test "$(printf '%s' "$readiness" | json_field 'response.ready')" = true

create_response="$(mutate_route POST '/api/learning-os/study/imports' \
  '{"filename":"deployment-import-smoke.colpkg","contentType":"application/zip"}')"
import_job_id="$(printf '%s' "$create_response" | json_field 'response.importJob.id')"
test -n "$import_job_id"

curl --fail --silent --show-error \
  --request PUT \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/zip' \
  --header 'Origin: https://convo-lab.com' \
  --header "X-CSRF-Token: $csrf_token" \
  --header "Cookie: token=$auth_token; XSRF-TOKEN=$csrf_cookie_raw" \
  --upload-file "$ARCHIVE_PATH" \
  "https://convo-lab.com/api/learning-os/study/imports/$import_job_id/upload" >/dev/null

complete_response="$(mutate_route POST \
  "/api/learning-os/study/imports/$import_job_id/complete")"
complete_status="$(printf '%s' "$complete_response" | json_field 'response.status')"
case "$complete_status" in
  pending|processing|completed) ;;
  *) echo "Unexpected import completion status: $complete_status" >&2; exit 1 ;;
esac

completed_response=""
for attempt in {1..60}; do
  completed_response="$(read_route "/api/learning-os/study/imports/$import_job_id")"
  import_status="$(printf '%s' "$completed_response" | json_field 'response.status')"
  case "$import_status" in
    completed) break ;;
    failed)
      echo "Import smoke failed: $completed_response" >&2
      exit 1
      ;;
    pending|processing)
      echo "Import processing attempt $attempt/60: $import_status"
      sleep 2
      ;;
    *) echo "Unexpected import status: $import_status" >&2; exit 1 ;;
  esac
done

test "$import_status" = completed
test "$(printf '%s' "$completed_response" | json_field 'response.preview.noteCount')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.preview.cardCount')" = 3
test "$(printf '%s' "$completed_response" | json_field 'response.preview.reviewLogCount')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.preview.mediaReferenceCount')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.sourceSizeBytes')" = "$archive_size"

direct_import_response="$(docker exec \
  -e API_TOKEN="$proxy_token" \
  -e IMPORT_JOB_ID="$import_job_id" \
  learning-os-api php -r '
    $context = stream_context_create(["http" => [
        "header" => "Accept: application/json\r\nAuthorization: Bearer "
            .getenv("API_TOKEN")."\r\n",
        "timeout" => 10,
    ]]);
    $body = file_get_contents(
        "http://127.0.0.1:8080/api/study/imports/".getenv("IMPORT_JOB_ID"),
        false,
        $context
    );
    if ($body === false) exit(1);
    echo $body;
  ')"
test "$(printf '%s' "$direct_import_response" | json_field \
  'response.data.summary.imported_decks')" = 1
test "$(printf '%s' "$direct_import_response" | json_field \
  'response.data.summary.imported_cards')" = 3
test "$(printf '%s' "$direct_import_response" | json_field \
  'response.data.summary.imported_review_logs')" = 2
test "$(printf '%s' "$direct_import_response" | json_field \
  'response.data.summary.imported_media_assets')" = 2

cancel_create_response="$(mutate_route POST '/api/learning-os/study/imports' \
  '{"filename":"deployment-import-cancel-smoke.colpkg","contentType":"application/zip"}')"
cancel_job_id="$(printf '%s' "$cancel_create_response" | json_field 'response.importJob.id')"
cancel_response="$(mutate_route POST \
  "/api/learning-os/study/imports/$cancel_job_id/cancel")"
test "$(printf '%s' "$cancel_response" | json_field 'response.status')" = failed
test "$(printf '%s' "$cancel_response" | json_field \
  'response.errorMessage === "Study import upload was cancelled."')" = true

echo "Learning OS import lifecycle smoke completed."
