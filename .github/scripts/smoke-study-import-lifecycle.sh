#!/usr/bin/env bash

set -euo pipefail

: "${ACTIVE_COLOR:?ACTIVE_COLOR is required}"

SERVER_CONTAINER="convolab-server-$ACTIVE_COLOR"
ARCHIVE_DIR=""
ARCHIVE_PATH=""
SMOKE_EMAIL=""
RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

delete_learning_os_smoke_user() {
  [ -n "$SMOKE_EMAIL" ] || return 0

  docker exec -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
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

cleanup() {
  local exit_status=$?
  local cleanup_status=0
  trap - EXIT
  set +e

  if [ "$exit_status" -ne 0 ]; then
    echo "Learning OS worker logs after import smoke failure:" >&2
    docker logs --since "$RUN_STARTED_AT" --tail=300 learning-os-worker >&2 || true
  fi

  delete_learning_os_smoke_user || cleanup_status=1
  if [ -n "$ARCHIVE_DIR" ]; then
    rm -rf "$ARCHIVE_DIR" || cleanup_status=1
  fi

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
archive_sha256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"

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

read_route() {
  curl --fail --silent --show-error \
    --header 'Accept: application/json' \
    --header "Authorization: Bearer $proxy_token" \
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
    --header "Authorization: Bearer $proxy_token"
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

readiness="$(read_route '/api/study/imports/readiness')"
test "$(printf '%s' "$readiness" | json_field 'response.ready')" = true

create_response="$(mutate_route POST '/api/study/imports' \
  '{"filename":"deployment-import-smoke.colpkg","content_type":"application/zip"}')"
import_job_id="$(printf '%s' "$create_response" | json_field 'response.data.import_job.id')"
test -n "$import_job_id"

curl --fail --silent --show-error \
  --request PUT \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/zip' \
  --header "Authorization: Bearer $proxy_token" \
  --upload-file "$ARCHIVE_PATH" \
  "https://convo-lab.com/api/study/imports/$import_job_id/upload" >/dev/null

stored_sha256_output="$(docker exec -e IMPORT_JOB_ID="$import_job_id" learning-os-api \
  php artisan tinker --execute='
    $job = App\Domain\Study\Models\StudyImportJob::query()
        ->findOrFail(getenv("IMPORT_JOB_ID"));
    $stream = Illuminate\Support\Facades\Storage::disk("study-imports")
        ->readStream($job->source_object_path);
    if (! is_resource($stream)) {
        throw new RuntimeException("Uploaded import archive could not be opened.");
    }
    try {
        $hash = hash_init("sha256");
        hash_update_stream($hash, $stream);
        echo "IMPORT_SMOKE_SHA256=".hash_final($hash);
    } finally {
        fclose($stream);
    }
  ' < /dev/null)"
stored_archive_sha256="$(printf '%s\n' "$stored_sha256_output" \
  | sed -n 's/^IMPORT_SMOKE_SHA256=//p' | tail -1)"
test -n "$stored_archive_sha256"
if [ "$stored_archive_sha256" != "$archive_sha256" ]; then
  echo "Uploaded import archive checksum mismatch: expected $archive_sha256, got $stored_archive_sha256" >&2
  exit 1
fi

complete_response="$(mutate_route POST \
  "/api/study/imports/$import_job_id/complete")"
complete_status="$(printf '%s' "$complete_response" | json_field 'response.data.status')"
case "$complete_status" in
  pending|processing|completed) ;;
  *) echo "Unexpected import completion status: $complete_status" >&2; exit 1 ;;
esac

completed_response=""
for attempt in {1..60}; do
  completed_response="$(read_route "/api/study/imports/$import_job_id")"
  import_status="$(printf '%s' "$completed_response" | json_field 'response.data.status')"
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
test "$(printf '%s' "$completed_response" | json_field 'response.data.preview.note_count')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.data.preview.card_count')" = 3
test "$(printf '%s' "$completed_response" | json_field 'response.data.preview.review_log_count')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.data.preview.media_reference_count')" = 2
test "$(printf '%s' "$completed_response" | json_field 'response.data.source_size_bytes')" = "$archive_size"
test "$(printf '%s' "$completed_response" | json_field \
  'response.data.summary.imported_decks')" = 1
test "$(printf '%s' "$completed_response" | json_field \
  'response.data.summary.imported_cards')" = 3
test "$(printf '%s' "$completed_response" | json_field \
  'response.data.summary.imported_review_logs')" = 2
test "$(printf '%s' "$completed_response" | json_field \
  'response.data.summary.imported_media_assets')" = 2

cancel_create_response="$(mutate_route POST '/api/study/imports' \
  '{"filename":"deployment-import-cancel-smoke.colpkg","content_type":"application/zip"}')"
cancel_job_id="$(printf '%s' "$cancel_create_response" | json_field 'response.data.import_job.id')"
cancel_response="$(mutate_route POST \
  "/api/study/imports/$cancel_job_id/cancel")"
test "$(printf '%s' "$cancel_response" | json_field 'response.data.status')" = failed
test "$(printf '%s' "$cancel_response" | json_field \
  'response.data.error_message === "Study import upload was cancelled."')" = true

echo "Learning OS import lifecycle smoke completed."
