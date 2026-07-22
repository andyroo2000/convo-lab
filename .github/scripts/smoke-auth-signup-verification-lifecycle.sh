#!/usr/bin/env bash

set -euo pipefail

: "${ACTIVE_COLOR:?ACTIVE_COLOR is required}"
: "${SMOKE_USER_EMAIL:?SMOKE_USER_EMAIL is required}"

SERVER_CONTAINER="convolab-server-$ACTIVE_COLOR"
BASE_URL="https://convo-lab.com"
SIGNUP_COOKIE_JAR=""
LOGIN_COOKIE_JAR=""
SIGNUP_BODY_FILE=""
LOGIN_BODY_FILE=""
SMOKE_EMAIL=""
SMOKE_INVITE_CODE=""
SMOKE_INVITE_ID=""
SMOKE_USER_ID=""
SMOKE_PASSWORD=""

json_field() {
  local expression="$1"

  docker exec -i -e JSON_EXPRESSION="$expression" "$SERVER_CONTAINER" \
    node --input-type=module --eval='
      process.stdin.setEncoding("utf8");
      let input = "";
      for await (const chunk of process.stdin) input += chunk;
      const response = JSON.parse(input);
      const value = Function(
        "response",
        `"use strict"; return (${process.env.JSON_EXPRESSION});`,
      )(response);
      if (value === undefined || value === null) process.exit(1);
      process.stdout.write(String(value));
    '
}

delete_disposable_account() {
  [ -n "$SMOKE_EMAIL" ] || return 0

  docker exec \
    -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
    -e AUTH_SMOKE_INVITE_CODE="$SMOKE_INVITE_CODE" \
    -e AUTH_SMOKE_INVITE_ID="$SMOKE_INVITE_ID" \
    learning-os-api php artisan tinker --execute='
      use App\Domain\Auth\Support\ConvoLabAccountSource;
      use Illuminate\Support\Facades\DB;

      $email = getenv("AUTH_SMOKE_EMAIL");
      $inviteCode = getenv("AUTH_SMOKE_INVITE_CODE");
      $inviteId = getenv("AUTH_SMOKE_INVITE_ID");

      DB::transaction(function () use ($email, $inviteCode, $inviteId): void {
          $projection = DB::table("admin_user_projections")
              ->where("email", $email)
              ->where("source_system", ConvoLabAccountSource::LEARNING_OS)
              ->lockForUpdate()
              ->first();
          $invite = DB::table("admin_invite_codes")
              ->where("id", $inviteId)
              ->where("code", $inviteCode)
              ->where("source_system", ConvoLabAccountSource::LEARNING_OS)
              ->lockForUpdate()
              ->first();

          if ($invite !== null) {
              DB::table("admin_invite_codes")->where("id", $inviteId)->delete();
          }
          if ($projection !== null) {
              DB::table("users")->where("id", $projection->user_id)->delete();
          }
      });

      if (
          DB::table("admin_user_projections")->where("email", $email)->exists()
          || DB::table("admin_invite_codes")->where("id", $inviteId)->exists()
          || DB::table("users")->whereRaw("LOWER(email) = ?", [strtolower($email)])->exists()
      ) {
          throw new RuntimeException("Disposable auth smoke state was not deleted.");
      }
    ' < /dev/null > /dev/null
}

cleanup() {
  local exit_status=$?
  local cleanup_status=0
  trap - EXIT
  set +e

  delete_disposable_account || cleanup_status=1
  rm -f \
    "$SIGNUP_COOKIE_JAR" \
    "$LOGIN_COOKIE_JAR" \
    "$SIGNUP_BODY_FILE" \
    "$LOGIN_BODY_FILE" || cleanup_status=1

  if [ "$exit_status" -eq 0 ] && [ "$cleanup_status" -ne 0 ]; then
    echo "Auth lifecycle passed, but disposable-state cleanup failed." >&2
    exit "$cleanup_status"
  fi
  exit "$exit_status"
}

trap cleanup EXIT

marker="$(cat /proc/sys/kernel/random/uuid)"
if ! [[ "$marker" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Unable to generate a valid auth smoke marker." >&2
  exit 1
fi

smoke_local_part="${SMOKE_USER_EMAIL%@*}"
smoke_domain="${SMOKE_USER_EMAIL##*@}"
SMOKE_EMAIL="${smoke_local_part}+learning-os-smoke-${marker:0:8}@${smoke_domain}"
SMOKE_INVITE_CODE="LOSMOKE${marker//-/}"
SMOKE_INVITE_CODE="${SMOKE_INVITE_CODE:0:20}"
SMOKE_INVITE_ID="$marker"
SMOKE_PASSWORD="LearningOsSmoke-${marker}"
if [ "${#SMOKE_EMAIL}" -gt 255 ]; then
  echo "The disposable auth smoke email exceeds 255 characters." >&2
  exit 1
fi
echo "::add-mask::$SMOKE_EMAIL"
echo "::add-mask::$SMOKE_PASSWORD"

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_INVITE_CODE="$SMOKE_INVITE_CODE" \
  -e AUTH_SMOKE_INVITE_ID="$SMOKE_INVITE_ID" \
  learning-os-api php artisan tinker --execute='
    use App\Domain\Admin\Models\AdminInviteCode;
    use App\Domain\Auth\Support\ConvoLabAccountSource;
    use App\Models\User;

    $email = getenv("AUTH_SMOKE_EMAIL");
    $code = getenv("AUTH_SMOKE_INVITE_CODE");
    $id = getenv("AUTH_SMOKE_INVITE_ID");
    if (
        User::query()->whereRaw("LOWER(email) = ?", [strtolower($email)])->exists()
        || AdminInviteCode::query()->where("id", $id)->orWhere("code", $code)->exists()
    ) {
        throw new RuntimeException("Disposable auth smoke identity already exists.");
    }

    $invite = new AdminInviteCode;
    $invite->id = $id;
    $invite->code = $code;
    $invite->used_by = null;
    $invite->convolab_used_by = null;
    $invite->used_at = null;
    $invite->created_at = now();
    $invite->source_system = ConvoLabAccountSource::LEARNING_OS;
    $invite->save();
  ' < /dev/null > /dev/null

SIGNUP_COOKIE_JAR="$(mktemp)"
LOGIN_COOKIE_JAR="$(mktemp)"
SIGNUP_BODY_FILE="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
chmod 600 "$SIGNUP_COOKIE_JAR" "$LOGIN_COOKIE_JAR" "$SIGNUP_BODY_FILE" "$LOGIN_BODY_FILE"

csrf_token_for() {
  local cookie_jar="$1"
  local csrf_cookie_raw

  curl --fail --silent --show-error \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    --header "Origin: $BASE_URL" \
    "$BASE_URL/api/auth/csrf" > /dev/null
  csrf_cookie_raw="$(awk '$6 == "XSRF-TOKEN" { value = $7 } END { print value }' "$cookie_jar")"
  test -n "$csrf_cookie_raw"
  docker exec -e RAW_CSRF_TOKEN="$csrf_cookie_raw" "$SERVER_CONTAINER" \
    node --input-type=module --eval='process.stdout.write(decodeURIComponent(process.env.RAW_CSRF_TOKEN))'
}

post_json() {
  local path="$1"
  local body_file="$2"
  local cookie_jar="$3"
  local csrf_token="$4"

  curl --fail --silent --show-error \
    --request POST \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "Origin: $BASE_URL" \
    --header "X-CSRF-Token: $csrf_token" \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    --data-binary "@$body_file" \
    "$BASE_URL$path"
}

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_PASSWORD="$SMOKE_PASSWORD" \
  -e AUTH_SMOKE_INVITE_CODE="$SMOKE_INVITE_CODE" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      email: process.env.AUTH_SMOKE_EMAIL,
      password: process.env.AUTH_SMOKE_PASSWORD,
      name: "Learning OS auth smoke",
      inviteCode: process.env.AUTH_SMOKE_INVITE_CODE,
    }));
  ' > "$SIGNUP_BODY_FILE"

signup_csrf_token="$(csrf_token_for "$SIGNUP_COOKIE_JAR")"
signup_response="$(post_json \
  '/api/auth/signup' "$SIGNUP_BODY_FILE" "$SIGNUP_COOKIE_JAR" "$signup_csrf_token")"
SMOKE_USER_ID="$(printf '%s' "$signup_response" | json_field 'response.id')"
if ! [[ "$SMOKE_USER_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Signup returned an invalid ConvoLab user id." >&2
  exit 1
fi
test "$(printf '%s' "$signup_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$signup_response" | json_field 'response.emailVerified')" = false
test -n "$(awk '$6 == "token" { value = $7 } END { print value }' "$SIGNUP_COOKIE_JAR")"

current_account="$(curl --fail --silent --show-error \
  --header 'Accept: application/json' \
  --cookie "$SIGNUP_COOKIE_JAR" \
  --cookie-jar "$SIGNUP_COOKIE_JAR" \
  "$BASE_URL/api/auth/me")"
test "$(printf '%s' "$current_account" | json_field 'response.id')" = "$SMOKE_USER_ID"
test "$(printf '%s' "$current_account" | json_field 'response.emailVerified')" = false

legacy_user_count="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" "$SERVER_CONTAINER" \
  node --input-type=module --eval='
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    try {
      process.stdout.write(String(await prisma.user.count({
        where: { email: process.env.AUTH_SMOKE_EMAIL },
      })));
    } finally {
      await prisma.$disconnect();
    }
  ')"
test "$legacy_user_count" = 0

verification_token_ready=false
for attempt in {1..30}; do
  token_count="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
    php artisan tinker --execute='
      $userId = App\Models\User::query()
          ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
          ->value("id");
      echo "AUTH_SMOKE_TOKEN_COUNT=".($userId === null ? 0 : App\Domain\Auth\Models\ConvoLabEmailVerificationToken::query()
          ->where("user_id", $userId)
          ->count()).PHP_EOL;
    ' < /dev/null \
    | sed -n 's/^AUTH_SMOKE_TOKEN_COUNT=//p' \
    | tail -1)"
  if [ "$token_count" = 1 ]; then
    verification_token_ready=true
    break
  fi
  echo "Verification mail job attempt $attempt/30 has not issued a token; retrying."
  sleep 2
done
if [ "$verification_token_ready" != true ]; then
  echo "The signup verification mail job did not issue a token." >&2
  exit 1
fi

verification_token_output="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
  php artisan tinker --execute='
    $user = App\Models\User::query()
        ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
        ->sole();
    $token = app(App\Domain\Auth\Actions\IssueConvoLabVerificationTokenAction::class)
        ->handle((int) $user->getKey());
    echo "AUTH_SMOKE_VERIFICATION_TOKEN=".$token.PHP_EOL;
  ' < /dev/null)"
verification_token="$(printf '%s\n' "$verification_token_output" \
  | sed -n 's/^AUTH_SMOKE_VERIFICATION_TOKEN=//p' \
  | grep -E '^[0-9a-f]{64}$' \
  | tail -1)"
test -n "$verification_token"
echo "::add-mask::$verification_token"

verification_response="$(curl --fail --silent --show-error \
  --header 'Accept: application/json' \
  "$BASE_URL/api/verification/$verification_token")"
test "$(printf '%s' "$verification_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$verification_response" | json_field 'response.message')" = \
  'Email verified successfully'

verified_account="$(curl --fail --silent --show-error \
  --header 'Accept: application/json' \
  --cookie "$SIGNUP_COOKIE_JAR" \
  "$BASE_URL/api/auth/me")"
test "$(printf '%s' "$verified_account" | json_field 'response.id')" = "$SMOKE_USER_ID"
test "$(printf '%s' "$verified_account" | json_field 'response.emailVerified')" = true
test -n "$(printf '%s' "$verified_account" | json_field 'response.emailVerifiedAt')"

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_PASSWORD="$SMOKE_PASSWORD" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      email: process.env.AUTH_SMOKE_EMAIL,
      password: process.env.AUTH_SMOKE_PASSWORD,
    }));
  ' > "$LOGIN_BODY_FILE"
login_csrf_token="$(csrf_token_for "$LOGIN_COOKIE_JAR")"
login_response="$(post_json \
  '/api/auth/login' "$LOGIN_BODY_FILE" "$LOGIN_COOKIE_JAR" "$login_csrf_token")"
test "$(printf '%s' "$login_response" | json_field 'response.id')" = "$SMOKE_USER_ID"
test "$(printf '%s' "$login_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$login_response" | json_field 'response.emailVerified')" = true
test -n "$(awk '$6 == "token" { value = $7 } END { print value }' "$LOGIN_COOKIE_JAR")"

delete_disposable_account
SMOKE_EMAIL=""
echo "Learning OS signup and verification lifecycle smoke completed."
