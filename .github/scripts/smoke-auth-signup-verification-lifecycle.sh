#!/usr/bin/env bash

set -Eeuo pipefail

: "${ACTIVE_COLOR:?ACTIVE_COLOR is required}"
: "${SMOKE_USER_EMAIL:?SMOKE_USER_EMAIL is required}"

SERVER_CONTAINER="convolab-server-$ACTIVE_COLOR"
BASE_URL="https://convo-lab.com"
SIGNUP_COOKIE_JAR=""
LOGIN_COOKIE_JAR=""
RESET_COOKIE_JAR=""
OLD_LOGIN_COOKIE_JAR=""
NEW_LOGIN_COOKIE_JAR=""
SIGNUP_BODY_FILE=""
LOGIN_BODY_FILE=""
RESET_REQUEST_BODY_FILE=""
RESET_BODY_FILE=""
OLD_LOGIN_BODY_FILE=""
NEW_LOGIN_BODY_FILE=""
DELETE_BODY_FILE=""
VERIFICATION_BODY_FILE=""
PROFILE_BODY_FILE=""
PROFILE_RESTORE_BODY_FILE=""
SMOKE_EMAIL=""
SMOKE_INVITE_CODE=""
SMOKE_INVITE_ID=""
SMOKE_USER_ID=""
SMOKE_PASSWORD=""
SMOKE_RESET_PASSWORD=""

report_error() {
  local exit_status=$?
  local failed_line="${BASH_LINENO[0]:-unknown}"

  trap - ERR
  echo "Auth lifecycle command failed at line $failed_line with exit status $exit_status." >&2
  return "$exit_status"
}

trap report_error ERR

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

assert_learning_os_session_cookie() {
  local cookie_jar="$1"
  local context="$2"
  local cookie_value

  cookie_value="$(awk '$6 == "learning_os_session" { value = $7 } END { print value }' \
    "$cookie_jar")"
  if [ -z "$cookie_value" ]; then
    echo "$context did not establish a Learning OS browser session." >&2
    return 1
  fi
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
      $smokeUserId = null;

      DB::transaction(function () use ($email, $inviteCode, $inviteId, &$smokeUserId): void {
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
          DB::table("password_reset_tokens")->where("email", $email)->delete();
          if ($projection !== null) {
              $smokeUserId = (int) $projection->user_id;
              DB::table("users")->where("id", $projection->user_id)->delete();
          }
      });

      if (
          DB::table("admin_user_projections")->where("email", $email)->exists()
          || DB::table("admin_invite_codes")->where("id", $inviteId)->exists()
          || DB::table("users")->whereRaw("LOWER(email) = ?", [strtolower($email)])->exists()
          || DB::table("password_reset_tokens")->where("email", $email)->exists()
          || ($smokeUserId !== null && DB::table("convolab_email_verification_tokens")
              ->where("user_id", $smokeUserId)
              ->exists())
      ) {
          throw new RuntimeException("Disposable auth smoke state was not deleted.");
      }
    ' < /dev/null > /dev/null
}

cleanup() {
  local exit_status=$?
  local cleanup_status=0
  trap - EXIT ERR
  set +e

  delete_disposable_account || cleanup_status=1
  rm -f \
    "$SIGNUP_COOKIE_JAR" \
    "$LOGIN_COOKIE_JAR" \
    "$RESET_COOKIE_JAR" \
    "$OLD_LOGIN_COOKIE_JAR" \
    "$NEW_LOGIN_COOKIE_JAR" \
    "$SIGNUP_BODY_FILE" \
    "$LOGIN_BODY_FILE" \
    "$RESET_REQUEST_BODY_FILE" \
    "$RESET_BODY_FILE" \
    "$OLD_LOGIN_BODY_FILE" \
    "$NEW_LOGIN_BODY_FILE" \
    "$DELETE_BODY_FILE" \
    "$VERIFICATION_BODY_FILE" \
    "$PROFILE_BODY_FILE" \
    "$PROFILE_RESTORE_BODY_FILE" || cleanup_status=1

  if [ "$cleanup_status" -ne 0 ]; then
    if [ "$exit_status" -eq 0 ]; then
      echo "Auth lifecycle passed, but disposable-state cleanup failed." >&2
      exit "$cleanup_status"
    fi
    echo "Auth lifecycle failed and disposable-state cleanup also failed; manual cleanup is required." >&2
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
SMOKE_RESET_PASSWORD="LearningOsReset-${marker}"
if [ "${#SMOKE_EMAIL}" -gt 255 ]; then
  echo "The disposable auth smoke email exceeds 255 characters." >&2
  exit 1
fi
echo "::add-mask::$SMOKE_EMAIL"
echo "::add-mask::$SMOKE_PASSWORD"
echo "::add-mask::$SMOKE_RESET_PASSWORD"

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
RESET_COOKIE_JAR="$(mktemp)"
OLD_LOGIN_COOKIE_JAR="$(mktemp)"
NEW_LOGIN_COOKIE_JAR="$(mktemp)"
SIGNUP_BODY_FILE="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
RESET_REQUEST_BODY_FILE="$(mktemp)"
RESET_BODY_FILE="$(mktemp)"
OLD_LOGIN_BODY_FILE="$(mktemp)"
NEW_LOGIN_BODY_FILE="$(mktemp)"
DELETE_BODY_FILE="$(mktemp)"
VERIFICATION_BODY_FILE="$(mktemp)"
PROFILE_BODY_FILE="$(mktemp)"
PROFILE_RESTORE_BODY_FILE="$(mktemp)"
chmod 600 \
  "$SIGNUP_COOKIE_JAR" \
  "$LOGIN_COOKIE_JAR" \
  "$RESET_COOKIE_JAR" \
  "$OLD_LOGIN_COOKIE_JAR" \
  "$NEW_LOGIN_COOKIE_JAR" \
  "$SIGNUP_BODY_FILE" \
  "$LOGIN_BODY_FILE" \
  "$RESET_REQUEST_BODY_FILE" \
  "$RESET_BODY_FILE" \
  "$OLD_LOGIN_BODY_FILE" \
  "$NEW_LOGIN_BODY_FILE" \
  "$DELETE_BODY_FILE" \
  "$VERIFICATION_BODY_FILE" \
  "$PROFILE_BODY_FILE" \
  "$PROFILE_RESTORE_BODY_FILE"

csrf_token_for() {
  local cookie_jar="$1"
  local csrf_cookie_raw

  curl --fail --silent --show-error \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    --header "Origin: $BASE_URL" \
    "$BASE_URL/sanctum/csrf-cookie" > /dev/null
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
  local response_file
  local headers_file
  local status
  local retry_after

  response_file="$(mktemp)"
  headers_file="$(mktemp)"
  chmod 600 "$response_file" "$headers_file"

  if ! status="$(curl --silent --show-error \
    --dump-header "$headers_file" \
    --output "$response_file" \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "Origin: $BASE_URL" \
    --header "X-XSRF-TOKEN: $csrf_token" \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    --data-binary "@$body_file" \
    "$BASE_URL$path")"; then
    echo "POST $path failed before receiving an HTTP response." >&2
    rm -f "$response_file" "$headers_file"
    return 1
  fi

  if [[ "$status" =~ ^2[0-9]{2}$ ]]; then
    cat "$response_file"
    rm -f "$response_file" "$headers_file"
    return 0
  fi

  retry_after="$(awk '
    tolower($1) == "retry-after:" { gsub("\\r", "", $2); value = $2 }
    END { print value }
  ' "$headers_file")"
  echo "POST $path returned HTTP $status${retry_after:+ (Retry-After: $retry_after seconds)}." >&2
  if [ -s "$response_file" ]; then
    echo "Response body (first 4096 bytes):" >&2
    head -c 4096 "$response_file" >&2
    echo >&2
  fi
  rm -f "$response_file" "$headers_file"
  return 1
}

post_json_status() {
  local path="$1"
  local body_file="$2"
  local cookie_jar="$3"
  local csrf_token="$4"

  curl --silent --show-error \
    --output /dev/null \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --header "Origin: $BASE_URL" \
    --header "X-XSRF-TOKEN: $csrf_token" \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    --data-binary "@$body_file" \
    "$BASE_URL$path"
}

session_get_json() {
  local url="$1"
  local cookie_jar="$2"

  curl --fail --silent --show-error \
    --header 'Accept: application/json' \
    --header "Origin: $BASE_URL" \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    "$url"
}

session_get_status() {
  local url="$1"
  local cookie_jar="$2"

  curl --silent --show-error \
    --output /dev/null \
    --write-out '%{http_code}' \
    --header 'Accept: application/json' \
    --header "Origin: $BASE_URL" \
    --cookie "$cookie_jar" \
    --cookie-jar "$cookie_jar" \
    "$url"
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
  '/api/convolab/browser/auth/signup' \
  "$SIGNUP_BODY_FILE" \
  "$SIGNUP_COOKIE_JAR" \
  "$signup_csrf_token")"
SMOKE_USER_ID="$(printf '%s' "$signup_response" | json_field 'response.id')"
if ! [[ "$SMOKE_USER_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Signup returned an invalid ConvoLab user id." >&2
  exit 1
fi
test "$(printf '%s' "$signup_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$signup_response" | json_field 'response.emailVerified')" = false
assert_learning_os_session_cookie "$SIGNUP_COOKIE_JAR" "Signup"

current_account="$(session_get_json \
  "$BASE_URL/api/convolab/auth/me" \
  "$SIGNUP_COOKIE_JAR")"
printf '%s' "$current_account" | docker exec \
  -i \
  -e EXPECTED_USER_ID="$SMOKE_USER_ID" \
  -e EXPECTED_USER_EMAIL="$SMOKE_EMAIL" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    let body = "";
    for await (const chunk of process.stdin) body += chunk;
    const account = JSON.parse(body);
    if (
      account.id !== process.env.EXPECTED_USER_ID
      || account.email.toLowerCase() !== process.env.EXPECTED_USER_EMAIL.toLowerCase()
      || account.role !== "USER"
      || account.emailVerified !== false
      || typeof account.seenSampleContentGuide !== "boolean"
      || typeof account.seenCustomContentGuide !== "boolean"
    ) process.exit(1);
  '

generation_quota="$(session_get_json \
  "$BASE_URL/api/convolab/auth/me/quota" \
  "$SIGNUP_COOKIE_JAR")"
printf '%s' "$generation_quota" | docker exec \
  -i \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    let body = "";
    for await (const chunk of process.stdin) body += chunk;
    const response = JSON.parse(body);
    const isSafeNonNegativeInteger = (value) =>
      Number.isSafeInteger(value) && value >= 0;
    const cooldownIsValid =
      response.cooldown
      && typeof response.cooldown.active === "boolean"
      && isSafeNonNegativeInteger(response.cooldown.remainingSeconds)
      && response.cooldown.active === (response.cooldown.remainingSeconds > 0);

    if (!cooldownIsValid || typeof response.unlimited !== "boolean") process.exit(1);

    if (response.unlimited) {
      if (
        response.quota !== null
        || response.cooldown.active
        || response.cooldown.remainingSeconds !== 0
      ) process.exit(1);
      process.exit(0);
    }

    const quota = response.quota;
    const resetPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (
      !quota
      || !isSafeNonNegativeInteger(quota.used)
      || !Number.isSafeInteger(quota.limit)
      || quota.limit <= 0
      || !isSafeNonNegativeInteger(quota.remaining)
      || quota.remaining !== Math.max(0, quota.limit - quota.used)
      || typeof quota.resetsAt !== "string"
      || !resetPattern.test(quota.resetsAt)
      || Number.isNaN(Date.parse(quota.resetsAt))
    ) process.exit(1);
  '

original_custom_content_guide="$(printf '%s' "$current_account" \
  | json_field 'response.seenCustomContentGuide')"
docker exec \
  -e AUTH_SMOKE_PROFILE_VALUE="$original_custom_content_guide" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      seenCustomContentGuide: process.env.AUTH_SMOKE_PROFILE_VALUE !== "true",
    }));
  ' > "$PROFILE_BODY_FILE"
docker exec \
  -e AUTH_SMOKE_PROFILE_VALUE="$original_custom_content_guide" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      seenCustomContentGuide: process.env.AUTH_SMOKE_PROFILE_VALUE === "true",
    }));
  ' > "$PROFILE_RESTORE_BODY_FILE"

profile_csrf_token="$(csrf_token_for "$SIGNUP_COOKIE_JAR")"
profile_response="$(curl --fail --silent --show-error \
  --request PATCH \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header "Origin: $BASE_URL" \
  --header "X-XSRF-TOKEN: $profile_csrf_token" \
  --cookie "$SIGNUP_COOKIE_JAR" \
  --cookie-jar "$SIGNUP_COOKIE_JAR" \
  --data-binary "@$PROFILE_BODY_FILE" \
  "$BASE_URL/api/convolab/auth/me")"
test "$(printf '%s' "$profile_response" | json_field 'response.seenCustomContentGuide')" != \
  "$original_custom_content_guide"

profile_restore_csrf_token="$(csrf_token_for "$SIGNUP_COOKIE_JAR")"
profile_restore_response="$(curl --fail --silent --show-error \
  --request PATCH \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header "Origin: $BASE_URL" \
  --header "X-XSRF-TOKEN: $profile_restore_csrf_token" \
  --cookie "$SIGNUP_COOKIE_JAR" \
  --cookie-jar "$SIGNUP_COOKIE_JAR" \
  --data-binary "@$PROFILE_RESTORE_BODY_FILE" \
  "$BASE_URL/api/convolab/auth/me")"
test "$(printf '%s' "$profile_restore_response" \
  | json_field 'response.seenCustomContentGuide')" = "$original_custom_content_guide"

verification_token_ready=false
for attempt in {1..30}; do
  if token_count="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
      php artisan tinker --execute='
        $userId = App\Models\User::query()
            ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
            ->value("id");
        echo "AUTH_SMOKE_TOKEN_COUNT=".($userId === null ? 0 : App\Domain\Auth\Models\ConvoLabEmailVerificationToken::query()
            ->where("user_id", $userId)
            ->count()).PHP_EOL;
      ' < /dev/null \
      | sed -n 's/^AUTH_SMOKE_TOKEN_COUNT=//p' \
      | tail -1)"; then
    if [ "$token_count" = 1 ]; then
      verification_token_ready=true
      break
    fi
  else
    echo "Verification mail token query attempt $attempt/30 failed; retrying." >&2
  fi
  echo "Verification mail job attempt $attempt/30 has not issued a token; retrying."
  if [ "$attempt" -lt 30 ]; then
    sleep 2
  fi
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

docker exec \
  -e AUTH_SMOKE_VERIFICATION_TOKEN="$verification_token" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      token: process.env.AUTH_SMOKE_VERIFICATION_TOKEN,
    }));
  ' > "$VERIFICATION_BODY_FILE"
verification_csrf_token="$(csrf_token_for "$SIGNUP_COOKIE_JAR")"
verification_response="$(post_json \
  '/api/convolab/browser/auth/verification' \
  "$VERIFICATION_BODY_FILE" \
  "$SIGNUP_COOKIE_JAR" \
  "$verification_csrf_token")"
test "$(printf '%s' "$verification_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$verification_response" | json_field 'response.message')" = \
  'Email verified successfully'

verified_account="$(session_get_json \
  "$BASE_URL/api/convolab/auth/me" \
  "$SIGNUP_COOKIE_JAR")"
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
  '/api/convolab/browser/auth/login' \
  "$LOGIN_BODY_FILE" \
  "$LOGIN_COOKIE_JAR" \
  "$login_csrf_token")"
test "$(printf '%s' "$login_response" | json_field 'response.id')" = "$SMOKE_USER_ID"
test "$(printf '%s' "$login_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
test "$(printf '%s' "$login_response" | json_field 'response.emailVerified')" = true
assert_learning_os_session_cookie "$LOGIN_COOKIE_JAR" "Login"

login_logout_csrf_token="$(csrf_token_for "$LOGIN_COOKIE_JAR")"
logout_response="$(post_json \
  '/api/convolab/browser/auth/logout' /dev/null "$LOGIN_COOKIE_JAR" "$login_logout_csrf_token")"
test -z "$logout_response"
test "$(session_get_status \
  "$BASE_URL/api/convolab/browser/auth/me" \
  "$LOGIN_COOKIE_JAR")" = 401

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({ email: process.env.AUTH_SMOKE_EMAIL }));
  ' > "$RESET_REQUEST_BODY_FILE"
# Password reset is a generic Learning OS/Fortify concern, so it intentionally
# uses the canonical routes instead of the ConvoLab compatibility namespace.
reset_csrf_token="$(csrf_token_for "$RESET_COOKIE_JAR")"
reset_request_response="$(post_json \
  '/api/auth/password/forgot' \
  "$RESET_REQUEST_BODY_FILE" \
  "$RESET_COOKIE_JAR" \
  "$reset_csrf_token")"
test -z "$reset_request_response"

reset_token_ready=false
for attempt in {1..30}; do
  if reset_token_count="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
      php artisan tinker --execute='
        echo "AUTH_SMOKE_RESET_TOKEN_COUNT=".Illuminate\Support\Facades\DB::table("password_reset_tokens")
            ->where("email", getenv("AUTH_SMOKE_EMAIL"))
            ->count().PHP_EOL;
      ' < /dev/null \
      | sed -n 's/^AUTH_SMOKE_RESET_TOKEN_COUNT=//p' \
      | tail -1)"; then
    if [ "$reset_token_count" = 1 ]; then
      reset_token_ready=true
      break
    fi
  else
    echo "Password reset token query attempt $attempt/30 failed; retrying." >&2
  fi
  echo "Password reset mail job attempt $attempt/30 has not issued a token; retrying."
  if [ "$attempt" -lt 30 ]; then
    sleep 2
  fi
done
if [ "$reset_token_ready" != true ]; then
  echo "The password reset mail job did not issue a broker token." >&2
  exit 1
fi

reset_token_output="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
  php artisan tinker --execute='
    if (config("app.password_reset_url") !== "https://convo-lab.com/reset-password") {
        throw new RuntimeException("Learning OS password reset URL is not the public ConvoLab route.");
    }
    $user = App\Models\User::query()
        ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
        ->sole();
    $token = Illuminate\Support\Facades\Password::broker()->createToken($user);
    $notification = new Illuminate\Auth\Notifications\ResetPassword($token);
    $actionUrl = $notification->toMail($user)->actionUrl;
    $query = parse_url($actionUrl, PHP_URL_QUERY);
    parse_str(is_string($query) ? $query : "", $parameters);
    if (
        strtok($actionUrl, "?") !== "https://convo-lab.com/reset-password"
        || ($parameters["email"] ?? null) !== $user->email
        || ($parameters["token"] ?? null) !== $token
    ) {
        throw new RuntimeException("Learning OS produced an invalid public password reset link.");
    }
    echo "AUTH_SMOKE_RESET_TOKEN=".$parameters["token"].PHP_EOL;
  ' < /dev/null)"
reset_token="$(printf '%s\n' "$reset_token_output" \
  | sed -n 's/^AUTH_SMOKE_RESET_TOKEN=//p' \
  | grep -E '^[A-Za-z0-9]+$' \
  | tail -1)"
test -n "$reset_token"
echo "::add-mask::$reset_token"

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_RESET_TOKEN="$reset_token" \
  -e AUTH_SMOKE_RESET_PASSWORD="$SMOKE_RESET_PASSWORD" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      email: process.env.AUTH_SMOKE_EMAIL,
      token: process.env.AUTH_SMOKE_RESET_TOKEN,
      password: process.env.AUTH_SMOKE_RESET_PASSWORD,
      password_confirmation: process.env.AUTH_SMOKE_RESET_PASSWORD,
    }));
  ' > "$RESET_BODY_FILE"
reset_response="$(post_json \
  '/api/auth/password/reset' "$RESET_BODY_FILE" "$RESET_COOKIE_JAR" "$reset_csrf_token")"
test -z "$reset_response"

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_RESET_PASSWORD="$SMOKE_RESET_PASSWORD" \
  learning-os-api php artisan tinker --execute='
    $user = App\Models\User::query()
        ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
        ->sole();
    if (! Illuminate\Support\Facades\Hash::check(getenv("AUTH_SMOKE_RESET_PASSWORD"), $user->password)) {
        throw new RuntimeException("Learning OS did not persist the reset password.");
    }
    if (Illuminate\Support\Facades\DB::table("password_reset_tokens")
        ->where("email", $user->email)
        ->exists()) {
        throw new RuntimeException("Consumed password reset token was retained.");
    }
  ' < /dev/null > /dev/null

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_PASSWORD="$SMOKE_PASSWORD" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      email: process.env.AUTH_SMOKE_EMAIL,
      password: process.env.AUTH_SMOKE_PASSWORD,
    }));
  ' > "$OLD_LOGIN_BODY_FILE"
old_login_csrf_token="$(csrf_token_for "$OLD_LOGIN_COOKIE_JAR")"
test "$(post_json_status \
  '/api/convolab/browser/auth/login' \
  "$OLD_LOGIN_BODY_FILE" \
  "$OLD_LOGIN_COOKIE_JAR" \
  "$old_login_csrf_token")" = 401

docker exec \
  -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" \
  -e AUTH_SMOKE_RESET_PASSWORD="$SMOKE_RESET_PASSWORD" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      email: process.env.AUTH_SMOKE_EMAIL,
      password: process.env.AUTH_SMOKE_RESET_PASSWORD,
    }));
  ' > "$NEW_LOGIN_BODY_FILE"
new_login_csrf_token="$(csrf_token_for "$NEW_LOGIN_COOKIE_JAR")"
new_login_response="$(post_json \
  '/api/convolab/browser/auth/login' \
  "$NEW_LOGIN_BODY_FILE" \
  "$NEW_LOGIN_COOKIE_JAR" \
  "$new_login_csrf_token")"
test "$(printf '%s' "$new_login_response" | json_field 'response.id')" = "$SMOKE_USER_ID"
test "$(printf '%s' "$new_login_response" | json_field 'response.email')" = "$SMOKE_EMAIL"
assert_learning_os_session_cookie "$NEW_LOGIN_COOKIE_JAR" "Password-reset login"

docker exec \
  -e AUTH_SMOKE_RESET_PASSWORD="$SMOKE_RESET_PASSWORD" \
  "$SERVER_CONTAINER" node --input-type=module --eval='
    process.stdout.write(JSON.stringify({
      current_password: process.env.AUTH_SMOKE_RESET_PASSWORD,
    }));
  ' > "$DELETE_BODY_FILE"
delete_csrf_token="$(csrf_token_for "$NEW_LOGIN_COOKIE_JAR")"
delete_status="$(curl --silent --show-error \
  --output /dev/null \
  --write-out '%{http_code}' \
  --request DELETE \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header "Origin: $BASE_URL" \
  --header "X-XSRF-TOKEN: $delete_csrf_token" \
  --cookie "$NEW_LOGIN_COOKIE_JAR" \
  --cookie-jar "$NEW_LOGIN_COOKIE_JAR" \
  --data-binary "@$DELETE_BODY_FILE" \
  "$BASE_URL/api/convolab/auth/me")"
test "$delete_status" = 204
test "$(session_get_status \
  "$BASE_URL/api/convolab/browser/auth/me" \
  "$NEW_LOGIN_COOKIE_JAR")" = 401

remaining_user_count="$(docker exec -e AUTH_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api \
  php artisan tinker --execute='
    echo "AUTH_SMOKE_USER_COUNT=".App\Models\User::query()
        ->where("convolab_email_normalized", getenv("AUTH_SMOKE_EMAIL"))
        ->count().PHP_EOL;
  ' < /dev/null \
  | sed -n 's/^AUTH_SMOKE_USER_COUNT=//p' \
  | tail -1)"
test "$remaining_user_count" = 0

delete_disposable_account
SMOKE_EMAIL=""
echo "Learning OS signup, verification, password reset, and account deletion lifecycle smoke completed."
