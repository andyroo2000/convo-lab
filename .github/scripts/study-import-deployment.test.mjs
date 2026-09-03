import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const requiredAuthLifecycleContracts = [
  'trap cleanup EXIT',
  'trap report_error ERR',
  ': "${JSON_TOOLS_CONTAINER:?JSON_TOOLS_CONTAINER is required}"',
  'Auth lifecycle command failed at line $failed_line with exit status $exit_status.',
  'assert_learning_os_session_cookie',
  'did not establish a Learning OS browser session.',
  'delete_disposable_account',
  'source_system", ConvoLabAccountSource::LEARNING_OS',
  'convolab_email_verification_tokens',
  'password_reset_tokens',
  'Auth lifecycle failed and disposable-state cleanup also failed; manual cleanup is required.',
  'SMOKE_EMAIL="${smoke_local_part}+learning-os-smoke-',
  'POST $path failed before receiving an HTTP response.',
  'POST $path returned HTTP $status${retry_after:+ (Retry-After: $retry_after seconds)}.',
  'Response body (first 4096 bytes):',
  '$BASE_URL/sanctum/csrf-cookie',
  'X-XSRF-TOKEN',
  'session_get_json()',
  'session_get_status()',
  '--header "Origin: $BASE_URL"',
  "'/api/convolab/browser/auth/signup'",
  '--request PATCH',
  '$BASE_URL/api/convolab/auth/me',
  'response.emailVerified',
  'AUTH_SMOKE_TOKEN_COUNT=',
  'if token_count="$(docker exec',
  'Verification mail token query attempt $attempt/30 failed; retrying.',
  'IssueConvoLabVerificationTokenAction::class',
  "'/api/convolab/browser/auth/verification'",
  "'/api/convolab/browser/auth/login'",
  "'/api/convolab/browser/auth/logout'",
  '$6 == "learning_os_session"',
  '$BASE_URL/api/convolab/browser/auth/me',
  "'/api/auth/password/forgot'",
  'AUTH_SMOKE_RESET_TOKEN_COUNT=',
  'if reset_token_count="$(docker exec',
  'Password reset token query attempt $attempt/30 failed; retrying.',
  'if [ "$attempt" -lt 30 ]; then',
  'AUTH_SMOKE_RESET_TOKEN=',
  'password_confirmation',
  "'/api/auth/password/reset'",
  '--request DELETE',
  '$BASE_URL/api/convolab/auth/me',
  'AUTH_SMOKE_USER_COUNT=',
  'Learning OS signup, verification, password reset, and account deletion lifecycle smoke completed.',
];

test('the staging workflow no longer runs retired Express migrations', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy.yml'),
    'utf8'
  );
  assert.ok(!workflow.includes('npx prisma migrate'));
  assert.ok(!workflow.includes('failed_migration'));
  assert.ok(!workflow.includes('postgres-stage'));
  assert.ok(!workflow.includes('redis-stage'));
});

test('the production workflow verifies the always-on Study API without rollout flags', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    "'Overview Learning OS'",
    "'Browser Learning OS'",
    "'Browser detail Learning OS'",
    "mutate_learning_os_route POST '/api/study/session/start'",
    "mutate_learning_os_route PATCH '/api/study/settings'",
    "mutate_learning_os_route POST '/api/study/new-queue/reorder'",
    "'/api/study/cards'",
    '"/api/study/cards/$study_card_smoke_id"',
    'study_card_smoke_id=',
    'Study card create, browser, queue, and delete smoke checks passed.',
    'bash .github/scripts/smoke-study-import-lifecycle.sh',
    'ensure_learning_os_service learning-os learning-os-api',
    'ensure_learning_os_worker',
    'current_image="$(docker inspect --format=\'{{.Config.Image}}\' "$container" 2>/dev/null || true)"',
    'current_config_revision="$(docker inspect',
    '| sed -n \'s/^LEARNING_OS_DEPLOY_CONFIG_REVISION=//p\'',
    'desired_deploy_config_revision="calendar-oauth-redirect-v1"',
    'upsert_env LEARNING_OS_SESSION_COOKIE "learning_os_session"',
    'upsert_env LEARNING_OS_SESSION_LIFETIME "10080"',
    'upsert_env LEARNING_OS_SESSION_SECURE_COOKIE "true"',
    'upsert_env LEARNING_OS_SESSION_SAME_SITE "lax"',
    'upsert_env LEARNING_OS_SANCTUM_STATEFUL_DOMAINS "convo-lab.com,www.convo-lab.com"',
    'upsert_env LEARNING_OS_CORS_ALLOWED_ORIGINS',
    'upsert_env LEARNING_OS_DEPLOY_CONFIG_REVISION "$desired_deploy_config_revision"',
    '[ "$current_config_revision" = "$desired_deploy_config_revision" ]',
    'GCS_CREDENTIAL_PATH="$RUNTIME_DIR/secrets/gcloud-key.json"',
    'LEGACY_GCS_CREDENTIAL_PATH="server/gcloud-key.json"',
    'if [ ! -s "$GCS_CREDENTIAL_PATH" ] && [ -s "$LEGACY_GCS_CREDENTIAL_PATH" ]; then',
    'install -D -m 600',
    'LEARNING_OS_RUNTIME_UID=33',
    'if [ ! -s "$GCS_CREDENTIAL_PATH" ]; then',
    'chown "$LEARNING_OS_RUNTIME_UID:$LEARNING_OS_RUNTIME_UID" "$GCS_CREDENTIAL_PATH"',
    'chmod 600 "$GCS_CREDENTIAL_PATH"',
    'test "$(stat -c \'%u:%g\' "$GCS_CREDENTIAL_PATH")" =',
    'test "$(stat -c \'%a\' "$GCS_CREDENTIAL_PATH")" = 600',
    '| tail -1 || true)"',
    '-o ServerAliveInterval=30',
    'docker update --restart=no "$container"',
    'docker exec "$container" php artisan queue:restart',
    'docker update --restart=unless-stopped "$container"',
    'WORKER_DRAIN_ATTEMPTS=780',
    'WORKER_DRAIN_TIMEOUT_MINUTES=$((WORKER_DRAIN_ATTEMPTS * WORKER_DRAIN_INTERVAL_SECONDS / 60))',
    '$container drain attempt $attempt/$WORKER_DRAIN_ATTEMPTS',
    '$COMPOSE up -d --no-deps --force-recreate learning-os-worker',
    'if [ "$current_worker_id" = "$DRAINING_WORKER_CONTAINER_ID" ]; then',
    'docker start learning-os-worker',
    'current_command="$(docker inspect --format=\'{{join .Config.Cmd " "}}\' "$container" 2>/dev/null || true)"',
    'desired_queue_argument="--queue=study-imports,study-card-drafts,default"',
    '&& [[ " $current_command " == *" $desired_queue_argument "* ]]; then',
  ]) {
    assert.match(workflow, new RegExp(requiredContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(
    workflow,
    /if container_uses_verified_learning_os_image "\$container" \\\n\s+&& \[ "\$running" = true \] \\\n\s+&& \[ "\$current_config_revision" = "\$desired_deploy_config_revision" \] \\\n\s+&& \[ "\$current_auth_mail_config_revision" = "\$auth_mail_config_revision" \] \\\n\s+&& \[ "\$current_google_oauth_config_revision" = "\$google_oauth_config_revision" \]; then/
  );
  assert.match(
    workflow,
    /if container_uses_verified_learning_os_image "\$container" \\\n\s+&& \[ "\$running" = true \] \\\n\s+&& \[ "\$current_config_revision" = "\$desired_deploy_config_revision" \] \\\n\s+&& \[ "\$current_auth_mail_config_revision" = "\$auth_mail_config_revision" \] \\\n\s+&& \[ "\$current_google_oauth_config_revision" = "\$google_oauth_config_revision" \] \\\n\s+&& \[\[ " \$current_command " == \*" \$desired_queue_argument "\* \]\]; then/
  );
  assert.doesNotMatch(workflow, /static-media-v2/);
  assert.doesNotMatch(workflow, /enable_(?:settings|overview|browser|new_queue|review|card|media|daily_audio|imports)/);
  assert.doesNotMatch(workflow, /ENABLE_(?:SETTINGS|OVERVIEW|BROWSER|NEW_QUEUE|REVIEW|CARD|MEDIA|DAILY_AUDIO|IMPORTS)/);
  assert.doesNotMatch(workflow, /studyApi[A-Z]/);
  assert.doesNotMatch(workflow, /rollback_study_flags|flag_state|desired_parent/);
  assert.match(workflow, /fetch_learning_os_route\(\) \{/);
  assert.match(workflow, /mutate_learning_os_route\(\) \{/);
  assert.doesNotMatch(workflow, /\/api\/learning-os\/study/);
  assert.doesNotMatch(
    workflow,
    /\$COMPOSE up -d --no-deps --force-recreate learning-os learning-os-worker/
  );

  const directReadHelper = workflow.slice(
    workflow.indexOf('fetch_learning_os_route() {'),
    workflow.indexOf('mutate_learning_os_route() {')
  );
  const directMutationHelper = workflow.slice(
    workflow.indexOf('mutate_learning_os_route() {'),
    workflow.indexOf('content_browser_path() {')
  );
  for (const sessionContract of [
    "--header 'Origin: https://convo-lab.com'",
    '--cookie "$content_browser_smoke_cookie_jar"',
  ]) {
    assert.ok(directReadHelper.includes(sessionContract));
    assert.ok(directMutationHelper.includes(sessionContract));
  }
  assert.ok(
    directMutationHelper.includes(
      '--header "X-XSRF-TOKEN: $content_browser_smoke_csrf_token"'
    )
  );
  assert.ok(directMutationHelper.includes('--cookie-jar "$content_browser_smoke_cookie_jar"'));
  assert.doesNotMatch(directReadHelper, /Authorization: Bearer/);
  assert.doesNotMatch(directMutationHelper, /Authorization: Bearer/);
  const browserSessionEstablished = workflow.indexOf(
    'Disposable Learning OS content browser session established.'
  );
  const directOverview = workflow.indexOf("'Overview Learning OS'");
  const importLifecycle = workflow.indexOf(
    'bash .github/scripts/smoke-study-import-lifecycle.sh'
  );
  const browserSessionCleanup = workflow.lastIndexOf(
    'cleanup_content_browser_smoke',
    workflow.indexOf('verify_study_api\n')
  );
  assert.ok(browserSessionEstablished < directOverview);
  assert.ok(directOverview < importLifecycle);
  assert.ok(importLifecycle < browserSessionCleanup);
  for (const inheritedSessionContract of [
    'STUDY_SMOKE_USER_ID="$content_browser_smoke_user_id"',
    'STUDY_SMOKE_COOKIE_JAR="$content_browser_smoke_cookie_jar"',
    'STUDY_SMOKE_CSRF_TOKEN="$content_browser_smoke_csrf_token"',
  ]) {
    assert.ok(workflow.includes(inheritedSessionContract));
  }
  const studyCardCreate = workflow.indexOf("'/api/study/cards'");
  const browserDetail = workflow.indexOf("'Browser detail Learning OS'");
  const queueReorder = workflow.indexOf(
    "mutate_learning_os_route POST '/api/study/new-queue/reorder'"
  );
  const studyCardDelete = workflow.indexOf(
    '"/api/study/cards/$study_card_smoke_id"',
    queueReorder
  );
  assert.ok(studyCardCreate < browserDetail);
  assert.ok(browserDetail < queueReorder);
  assert.ok(queueReorder < studyCardDelete);

  const verifyStudyApi = workflow.slice(
    workflow.indexOf('verify_study_api() {'),
    workflow.indexOf('stream_json_pair() {')
  );
  const postgresUserAssignment = verifyStudyApi.indexOf(
    'postgres_user="$(sed -n \'s/^POSTGRES_USER=//p\' .env.production | tail -1)"'
  );
  const postgresUserUse = verifyStudyApi.indexOf('--username="$postgres_user"');

  assert.ok(postgresUserAssignment >= 0);
  assert.ok(postgresUserUse > postgresUserAssignment);

  for (const requiredContract of [
    'wait_for_public_csrf() {',
    'local max_attempts=30',
    'for attempt in $(seq 1 "$max_attempts"); do',
    'Public Learning OS CSRF readiness attempt $attempt/$max_attempts failed.',
    'if [ "$attempt" -lt "$max_attempts" ]; then',
    'sleep 3',
    'if ! wait_for_public_csrf; then',
    'rm -f "$csrf_cookie_jar"',
  ]) {
    assert.ok(
      verifyStudyApi.includes(requiredContract),
      `Missing production CSRF readiness contract: ${requiredContract}`
    );
  }

  const publicCsrfWait = verifyStudyApi.indexOf('if ! wait_for_public_csrf; then');
  const csrfCookieRead = verifyStudyApi.indexOf('csrf_cookie_raw="$(awk');
  const verifyStudyApiInvocation = workflow.indexOf('\n            verify_study_api\n');
  const activeServerHealthy = workflow.lastIndexOf(
    'wait_for_health "convolab-server-$active_color"',
    verifyStudyApiInvocation
  );

  assert.ok(publicCsrfWait >= 0);
  assert.ok(publicCsrfWait < csrfCookieRead);
  assert.ok(activeServerHealthy >= 0);
  assert.ok(activeServerHealthy < verifyStudyApiInvocation);

  const credentialMigration = workflow.indexOf(
    'if [ ! -s "$GCS_CREDENTIAL_PATH" ] && [ -s "$LEGACY_GCS_CREDENTIAL_PATH" ]; then'
  );
  const credentialCheck = workflow.indexOf('if [ ! -s "$GCS_CREDENTIAL_PATH" ]; then');
  const imagePull = workflow.indexOf('timeout 600 docker pull "$desired_learning_os_reference"');
  const migration = workflow.indexOf(
    '$COMPOSE run --rm -T --no-deps learning-os php artisan migrate --force'
  );

  assert.ok(credentialMigration >= 0);
  assert.ok(credentialMigration < credentialCheck);
  assert.ok(credentialCheck >= 0);
  assert.ok(imagePull > credentialCheck);
  assert.ok(migration > credentialCheck);
});

test('production permanently routes migrated browser APIs', async () => {
  const [compose, workflow, router, viteConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'deploy/prod-router.conf.template'), 'utf8'),
    readFile(path.join(repositoryRoot, 'client/vite.config.ts'), 'utf8'),
  ]);

  const retiredRolloutContracts = [
    'LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED',
    'LEARNING_OS_DIRECT_AUTH_API_ENABLED',
    'LEARNING_OS_DIRECT_EPISODE_API_ENABLED',
    'LEARNING_OS_DIRECT_COURSE_API_ENABLED',
    'LEARNING_OS_DIRECT_SCRIPT_API_ENABLED',
    'LEARNING_OS_DIRECT_ADMIN_API_ENABLED',
    'DIRECT_ACCOUNT_API_ENABLED',
    'DIRECT_AUTH_API_ENABLED',
    'DIRECT_EPISODE_API_ENABLED',
    'DIRECT_COURSE_API_ENABLED',
    'DIRECT_SCRIPT_API_ENABLED',
    'DIRECT_ADMIN_API_ENABLED',
    'learningOsDirectAccountApi',
    'learningOsDirectAuthApi',
    'learningOsDirectEpisodeApi',
    'learningOsDirectCourseApi',
    'learningOsDirectScriptApi',
    'learningOsDirectAdminApi',
  ];

  for (const retiredContract of retiredRolloutContracts) {
    assert.ok(!compose.includes(retiredContract), `Retired compose flag remains: ${retiredContract}`);
    assert.ok(
      !workflow.includes(retiredContract),
      `Retired deployment flag remains: ${retiredContract}`
    );
    assert.ok(!router.includes(retiredContract), `Retired router flag remains: ${retiredContract}`);
  }

  for (const route of [
    '/api/convolab/episodes',
    '/api/convolab/courses',
    '/api/convolab/scripts',
    '/api/convolab/(?:dialogue|audio|images)',
    '/api/convolab/admin',
    '/api/study',
    '/api/daily-audio-practice',
  ]) {
    assert.ok(router.includes(`location ~ ^${route}`), `Missing permanent router route: ${route}`);
  }
  assert.ok(!router.includes('location ~ ^/api/learning-os/study(?:/|$)'));
  for (const route of [
    '/api/feature-flags',
    '/api/convolab/browser/tools/analytics',
  ]) {
    assert.ok(router.includes(`location = ${route}`), `Missing direct router route: ${route}`);
    assert.ok(viteConfig.includes(`'${route}'`), `Missing direct Vite route: ${route}`);
    assert.ok(viteConfig.indexOf(`'${route}'`) < viteConfig.indexOf("'/api':"));
  }

  for (const contract of [
    'verify_public_learning_os_browser_route() (',
    'https://convo-lab.com/sanctum/csrf-cookie',
    '$6 == "XSRF-TOKEN"',
    '$6 == "learning_os_session"',
    `xsrf_token="$(printf '%b' "\${encoded_xsrf_token//%/\\\\x}")"`,
    'https://convo-lab.com/api/convolab/auth/me',
    'https://convo-lab.com/api/convolab/browser/auth/me',
    'https://convo-lab.com/api/auth/password/forgot',
    'https://convo-lab.com/api/convolab/episodes',
    'https://convo-lab.com/api/convolab/courses',
    'https://convo-lab.com/api/convolab/scripts/job/00000000-0000-4000-8000-000000000000',
    'https://convo-lab.com/api/convolab/dialogue/job/00000000-0000-4000-8000-000000000000',
    'https://convo-lab.com/api/convolab/audio/job/00000000-0000-4000-8000-000000000000',
    'https://convo-lab.com/api/convolab/images/job/00000000-0000-4000-8000-000000000000',
    'https://convo-lab.com/api/study/overview',
    'https://convo-lab.com/api/auth/csrf',
    'https://convo-lab.com/api/learning-os/study/overview',
    'https://convo-lab.com/api/daily-audio-practice',
    'https://convo-lab.com/api/learning-os/study/daily-audio-practice',
    'https://convo-lab.com/api/feature-flags',
    'https://convo-lab.com/api/convolab/browser/tools/analytics',
    'https://convo-lab.com/api/convolab/admin/stats',
    'Unauthenticated direct account probe returned HTTP',
    'Unauthenticated direct browser auth probe returned HTTP',
    'Direct password reset route probe returned HTTP',
    'Direct password reset route did not return the Learning OS validation contract.',
    'Unauthenticated direct episode probe returned HTTP',
    'Unauthenticated direct course probe returned HTTP',
    'Unauthenticated direct script probe returned HTTP',
    'Unauthenticated direct generation probe ($generation_label) returned HTTP',
    'Direct generation probe ($generation_label) did not return the Learning OS auth contract.',
    'Unauthenticated direct Study probe ($study_label) returned HTTP',
    'Direct Study probe ($study_label) did not return the Learning OS auth contract.',
    'Retired Express API route returned HTTP $retired_express_status.',
    'Retired Express API route did not return the not-found contract.',
    'Unauthenticated direct feature flags probe returned HTTP',
    'Direct feature flags probe did not return the Learning OS auth contract.',
    'Direct Learning OS browser analytics probe returned HTTP',
    'Unauthenticated direct admin probe returned HTTP',
  ]) {
    assert.ok(workflow.includes(contract), `Missing permanent browser contract: ${contract}`);
  }

  assert.ok(
    !workflow.includes('decodeURIComponent'),
    'Production smoke checks must not require Node.js on the droplet host'
  );
  const publicGate = workflow.indexOf('if ! verify_public_health \\');
  assert.ok(publicGate >= 0);
  assert.ok(workflow.indexOf('verify_public_learning_os_browser_route', publicGate) > publicGate);
  assert.ok(publicGate < workflow.indexOf('write_active_color "$inactive_color"'));

  const csrfProbeStart = workflow.indexOf('csrf_status="$(curl');
  for (const probeName of [
    'account_status="$(curl',
    'browser_auth_status="$(curl',
    'password_reset_status="$(curl',
    'episode_status="$(curl',
    'course_status="$(curl',
    'script_status="$(curl',
    'admin_status="$(curl',
  ]) {
    const probeStart = workflow.indexOf(probeName, csrfProbeStart);
    const probeEnd = workflow.indexOf(')"', probeStart);
    const probe = workflow.slice(probeStart, probeEnd);
    assert.ok(probeStart >= 0);
    assert.ok(probeEnd > probeStart);
    assert.ok(probe.includes('--cookie "$cookie_jar"'));
    assert.ok(probe.includes("Accept: application/json"));
    assert.ok(probe.includes("--header 'Origin: https://convo-lab.com'"));
  }

  const passwordProbeStart = workflow.indexOf('password_reset_status="$(curl', csrfProbeStart);
  const passwordProbeEnd = workflow.indexOf(')"', passwordProbeStart);
  const passwordProbe = workflow.slice(passwordProbeStart, passwordProbeEnd);
  assert.ok(passwordProbe.includes('--request POST'));
  assert.ok(passwordProbe.includes('--header "X-XSRF-TOKEN: $xsrf_token"'));
  assert.ok(passwordProbe.includes(`--data '{"email":"not-an-email"}'`));
  assert.ok(workflow.includes('if [ "$password_reset_status" != 422 ]; then'));

  const rollbackStart = workflow.indexOf('rollback_router() {');
  const rollbackEnd = workflow.indexOf('active_color="blue"', rollbackStart);
  const rollback = workflow.slice(rollbackStart, rollbackEnd);
  assert.ok(rollback.includes('render_router_config "$previous_color"'));
  assert.ok(!rollback.includes('direct_'));
});

test('the production XSRF decoder runs without a host Node dependency', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'),
    'utf8'
  );
  const decoder = workflow
    .split('\n')
    .find((line) => line.includes(`xsrf_token="$(printf '%b'`))
    ?.trim();

  assert.ok(decoder, 'Missing production XSRF decoder');

  const { stdout } = await execFileAsync('bash', [
    '-c',
    `encoded_xsrf_token='abc%2Bdef%2Fghi%3D%3D'; ${decoder}; printf '%s' "$xsrf_token"`,
  ]);

  assert.equal(stdout, 'abc+def/ghi==');
});

test('generation routes are permanently proxied and production rehearsals cover them', async () => {
  const [stageCompose, productionCompose, workflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
  ]);

  const retiredProxyFlags =
    /LEARNING_OS_(?:COURSE_GENERATION|DIALOGUE_GENERATION|AUDIO_GENERATION|SCRIPT|AUTH|PROFILE|SIGNUP|VERIFICATION)_PROXY_ENABLED/;
  for (const source of [stageCompose, productionCompose, workflow]) {
    assert.doesNotMatch(source, retiredProxyFlags);
  }
  assert.doesNotMatch(stageCompose, /MONTHLY_GENERATION_LIMIT/);
  assert.doesNotMatch(productionCompose, /MONTHLY_GENERATION_LIMIT/);

  for (const requiredContract of [
    'wait_for_health "convolab-server-$active_color"',
    'bash .github/scripts/smoke-auth-signup-verification-lifecycle.sh',
    'Disposable Learning OS content browser session established.',
    'script_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'script_smoke_inserted=true',
    'cleanup_script_smoke best-effort',
    '"/api/convolab/scripts/$script_smoke_episode_id/status"',
    '"/api/convolab/scripts/job/$script_smoke_job_id"',
    '"https://convo-lab.com/api/convolab/scripts/media/$script_smoke_media_id?viewAs=$user_id"',
    '"https://convo-lab.com/api/convolab/scripts/$script_smoke_episode_id/audio/$script_smoke_render_id?viewAs=$user_id"',
    'Audio Script Learning OS routing and streaming smoke checks passed.',
    'course_generation_smoke_id="$(cat /proc/sys/kernel/random/uuid)"',
    'course_generation_smoke_inserted=false',
    'if [ "$course_generation_smoke_inserted" != true ]; then',
    'cleanup_course_generation_smoke best-effort',
    'COURSE_GENERATION_SMOKE_DELETED=',
    '[ "$mode" = best-effort ] && [ "$deleted_count" = 0 ]',
    '::warning::Unable to clean up course-generation smoke fixture',
    'App\\Domain\\Content\\Support\\ContentSourceSystem::CONVOLAB',
    '"generation_heartbeat_at" => now()->subDay()',
    'course_generation_smoke_inserted=true',
    'incompatible required',
    '"/api/convolab/courses/$course_generation_smoke_id/reset"',
    "'Course generation status after reset'",
    'response?.status !== "draft"',
    'cleanup_course_generation_smoke',
    'Course generation Learning OS write smoke check passed.',
    'dialogue_generation_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'dialogue_generation_smoke_job_id="$(cat /proc/sys/kernel/random/uuid)"',
    'dialogue_generation_smoke_inserted=true',
    'DB::table("content_dialogue_generation_jobs")->insert',
    '"state" => App\\Domain\\Content\\Support\\ContentDialogueGeneration::STATE_ACTIVE',
    '"progress" => 37',
    '"/api/convolab/dialogue/job/$dialogue_generation_smoke_job_id"',
    'cleanup_dialogue_generation_smoke best-effort',
    'Dialogue generation Learning OS routing smoke check passed.',
    'image_generation_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_dialogue_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_job_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_inserted=true',
    'DB::table("content_image_generation_jobs")->insert',
    '"state" => App\\Domain\\Content\\Support\\ContentImageGeneration::STATE_ACTIVE',
    "'/api/convolab/images/generate'",
    '"/api/convolab/images/job/$image_generation_smoke_job_id"',
    'cleanup_image_generation_smoke best-effort',
    'Image generation Learning OS routing smoke checks passed.',
    'audio_generation_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'audio_generation_smoke_dialogue_id="$(cat /proc/sys/kernel/random/uuid)"',
    'audio_generation_smoke_job_id="$(cat /proc/sys/kernel/random/uuid)"',
    'audio_generation_smoke_path="content-episodes/$audio_generation_smoke_episode_id/audio-1-1-0.mp3"',
    'audio_generation_smoke_inserted=true',
    'DB::table("content_audio_generation_jobs")->insert',
    '"state" => App\\Domain\\Content\\Support\\ContentAudioGeneration::STATE_COMPLETED',
    '"speed" => "slow"',
    '"speed" => "medium"',
    '"speed" => "normal"',
    '"/api/convolab/audio/job/$audio_generation_smoke_job_id"',
    'audio_generation_smoke_body="$(mktemp)"',
    '--cookie "$content_browser_smoke_cookie_jar"',
    '$(content_browser_path',
    '"/api/convolab/episodes/$audio_generation_smoke_episode_id/audio/1.0")',
    '"learning-os-audio-generation-smoke"',
    "^content-security-policy: sandbox; default-src 'none'",
    '^cross-origin-resource-policy: same-origin',
    '^x-content-type-options: nosniff',
    'cleanup_audio_generation_smoke best-effort',
    'Audio generation Learning OS routing and streaming smoke checks passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing permanent generation proxy contract: ${requiredContract}`
    );
  }

  const audioFixtureInsert = workflow.indexOf(
    'DB::table("content_audio_generation_jobs")->insert'
  );
  const audioStreamSmoke = workflow.slice(
    workflow.indexOf('audio_generation_smoke_body="$(mktemp)"', audioFixtureInsert),
    workflow.indexOf('cleanup_audio_generation_smoke', audioFixtureInsert)
  );
  assert.ok(audioFixtureInsert >= 0);
  assert.ok(audioStreamSmoke.includes('--cookie "$content_browser_smoke_cookie_jar"'));
  assert.ok(
    audioStreamSmoke.includes(
      '"https://convo-lab.com$(content_browser_path'
    )
  );
  assert.ok(!audioStreamSmoke.includes('Authorization: Bearer'));
  assert.ok(!audioStreamSmoke.includes('X-Convo-Lab-User-Id'));

  const serverHealthy = workflow.indexOf('wait_for_health "convolab-server-$active_color"');
  const browserSession = workflow.indexOf(
    'Disposable Learning OS content browser session established.'
  );
  const fixtureInsert = workflow.indexOf(
    'Illuminate\\Support\\Facades\\DB::table("content_courses")->insert'
  );
  const publicReset = workflow.indexOf(
    '"/api/convolab/courses/$course_generation_smoke_id/reset"'
  );
  const statusCheck = workflow.indexOf("'Course generation status after reset'");
  const successCleanup = workflow.lastIndexOf(
    'cleanup_course_generation_smoke',
    workflow.indexOf('Course generation Learning OS write smoke check passed.')
  );

  assert.ok(serverHealthy >= 0);
  assert.ok(serverHealthy < browserSession);
  assert.ok(browserSession < fixtureInsert);
  assert.ok(fixtureInsert < publicReset);
  assert.ok(publicReset < statusCheck);
  assert.ok(statusCheck < successCleanup);

  const fixtureInserted = workflow.indexOf('course_generation_smoke_inserted=true');
  assert.ok(browserSession < fixtureInserted);
  assert.ok(fixtureInserted < fixtureInsert);

  const failureCleanup = workflow.slice(
    workflow.indexOf('cleanup_deployment_resources() {'),
    workflow.indexOf('trap cleanup_deployment_resources EXIT')
  );
  assert.doesNotMatch(failureCleanup, retiredProxyFlags);
});

test('the retired Express workspace stays absent', async () => {
  const rootPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
  );
  const [clientConfig, playwrightConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, 'client/src/config.ts'), 'utf8'),
    readFile(path.join(repositoryRoot, 'playwright.config.ts'), 'utf8'),
  ]);

  for (const retiredPath of ['server', 'Dockerfile', 'docker-compose.yml', 'start.sh']) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }

  assert.deepEqual(rootPackage.workspaces, ['client', 'shared']);
  assert.equal(rootPackage.scripts['dev:server'], undefined);
  assert.equal(rootPackage.scripts['build:server'], undefined);
  assert.equal(rootPackage.scripts['migration:route-usage'], undefined);
  assert.equal(rootPackage.devDependencies.concurrently, undefined);
  assert.doesNotMatch(clientConfig, /localhost:3001/);
  assert.doesNotMatch(playwrightConfig, /cd server|localhost:3001/);
});

test('ConvoLab queue workers stay retired from deployment surfaces', async () => {
  const [stageCompose, productionCompose, stageWorkflow, productionWorkflow, scriptWorkflow] =
    await Promise.all([
      readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/deploy.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/run-script-prod.yml'), 'utf8'),
    ]);

  assert.doesNotMatch(stageCompose, /^\s+worker-stage:/m);
  assert.doesNotMatch(productionCompose, /^\s+worker:/m);
  assert.doesNotMatch(stageWorkflow, /Dockerfile\.worker|convolab-worker-stage/);
  assert.doesNotMatch(productionWorkflow, /force-recreate worker|worker_state=|convolab-worker/);
  assert.doesNotMatch(scriptWorkflow, /^\s+- worker$/m);
  assert.doesNotMatch(scriptWorkflow, /default: 'server'|service="server-/);
  assert.match(scriptWorkflow, /exec -T learning-os sh -c/);
});

test('retired database utilities and embedded credentials stay absent', async () => {
  for (const retiredPath of [
    'check-course-status.ts',
    'check-episode-speakers.ts',
    'check-episode.ts',
    'check-recent-episode.ts',
    'check-speaker-voices.ts',
    'delete-course.ts',
    'find-yuriy.ts',
  ]) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }

  await assert.rejects(
    execFileAsync('git', [
      'grep',
      '-nE',
      String.raw`postgres(ql)?://[^[:space:]'"]+:[^[:space:]'"]+@`,
      '--',
      '*.ts',
      '*.tsx',
    ]),
    (error) => error.code === 1
  );
});

test('the production stack configures Learning OS auth mail and password reset links', async () => {
  const [compose, workflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
  ]);

  for (const requiredComposeContract of [
    'CONVOLAB_CLIENT_URL: ${CLIENT_URL}',
    'PASSWORD_RESET_URL: ${CLIENT_URL}/reset-password',
    'CONVOLAB_ADMIN_EMAILS: ${ADMIN_EMAILS}',
    'MAIL_MAILER: resend',
    'RESEND_API_KEY: ${RESEND_API_KEY}',
    'MAIL_FROM_ADDRESS: ${LEARNING_OS_MAIL_FROM_ADDRESS}',
    'MAIL_FROM_NAME: ${LEARNING_OS_MAIL_FROM_NAME:-ConvoLab}',
    'LEARNING_OS_AUTH_MAIL_CONFIG_REVISION: ${LEARNING_OS_AUTH_MAIL_CONFIG_REVISION}',
    'LEARNING_OS_DEPLOY_CONFIG_REVISION: ${LEARNING_OS_DEPLOY_CONFIG_REVISION}',
  ]) {
    assert.ok(compose.includes(requiredComposeContract), requiredComposeContract);
  }

  for (const requiredWorkflowContract of [
    'DEPLOY_RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}',
    'if [ -z "$DEPLOY_RESEND_API_KEY" ]; then',
    '::error::RESEND_API_KEY secret is not set',
    'DEPLOY_RESEND_API_KEY=%q',
    'upsert_env RESEND_API_KEY "$DEPLOY_RESEND_API_KEY"',
    'read_env_value() {',
    'if [ -z "$email_from" ]; then',
    'email_from="ConvoLab <noreply@convolab.app>"',
    'upsert_env EMAIL_FROM "$email_from"',
    `if [[ "$value" == \\"*\\" ]] || [[ "$value" == \\'*\\' ]]; then`,
    'if [ -z "$resend_api_key" ]; then',
    'if ! [[ "$client_url" =~ ^https://[^[:space:]]+$ ]]; then',
    'if [ -z "$admin_emails" ]; then',
    'if ! [[ "$mail_from_address" =~',
    'upsert_env LEARNING_OS_MAIL_FROM_ADDRESS "$mail_from_address"',
    'upsert_env LEARNING_OS_MAIL_FROM_NAME "$mail_from_name"',
    'auth_mail_config_revision="$(printf \'%s\\0%s\\0%s\\0%s\\0%s\'',
    '| sha256sum',
    'upsert_env LEARNING_OS_AUTH_MAIL_CONFIG_REVISION "$auth_mail_config_revision"',
    "| sed -n 's/^LEARNING_OS_AUTH_MAIL_CONFIG_REVISION=//p'",
    '[ "$current_auth_mail_config_revision" = "$auth_mail_config_revision" ]',
    '-e EXPECTED_CLIENT_URL="$client_url"',
    '-e EXPECTED_ADMIN_EMAILS="$admin_emails"',
    '-e EXPECTED_MAIL_FROM_ADDRESS="$mail_from_address"',
    '-e EXPECTED_MAIL_FROM_NAME="$mail_from_name"',
    'config("mail.default") !== "resend"',
    'blank(config("services.resend.key"))',
    'config("services.convolab.admin_emails") !== $expectedAdminEmails',
    'Learning OS browser auth configuration is incomplete.',
  ]) {
    assert.ok(workflow.includes(requiredWorkflowContract), requiredWorkflowContract);
  }

  const configuration = workflow.indexOf('upsert_env LEARNING_OS_MAIL_FROM_ADDRESS');
  const deployRevisionConfiguration = workflow.indexOf(
    'upsert_env LEARNING_OS_DEPLOY_CONFIG_REVISION "$desired_deploy_config_revision"'
  );
  const resendUpsert = workflow.indexOf('upsert_env RESEND_API_KEY "$DEPLOY_RESEND_API_KEY"');
  const resendRead = workflow.indexOf('resend_api_key="$(read_env_value RESEND_API_KEY)"');
  const emailFromRead = workflow.indexOf('email_from="$(read_env_value EMAIL_FROM)"');
  const emailFromDefault = workflow.indexOf(
    'email_from="ConvoLab <noreply@convolab.app>"'
  );
  const emailFromValidation = workflow.indexOf(
    'if ! [[ "$mail_from_address" =~'
  );
  const imagePull = workflow.indexOf('timeout 600 docker pull "$desired_learning_os_reference"');
  const apiHealth = workflow.indexOf('wait_for_health learning-os-api');
  const runtimeConfiguration = workflow.indexOf(
    'config("mail.default") !== "resend"'
  );
  assert.ok(configuration >= 0);
  assert.ok(deployRevisionConfiguration >= 0);
  assert.ok(resendUpsert >= 0);
  assert.ok(resendUpsert < resendRead);
  assert.ok(emailFromRead < emailFromDefault);
  assert.ok(emailFromDefault < emailFromValidation);
  assert.ok(configuration < imagePull);
  assert.ok(deployRevisionConfiguration < imagePull);
  assert.ok(apiHealth < runtimeConfiguration);
});

test('the production workflow does not expose retired database cutover tools', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const retiredContract of [
    'import_historical_media',
    'IMPORT_HISTORICAL_MEDIA',
    'export-convolab-study-media',
    'migration:import-convolab-media',
    'migration:import-convolab-daily-audio',
    'convolab-learning-os-missing-media',
    'rebuild_database',
    'REBUILD_DATABASE',
    'rehearsal:import-convolab',
    'learning_os_convolab_source',
    'learning-os-before-rebuild',
    'preserved_knowledge_profiles',
  ]) {
    assert.ok(
      !workflow.includes(retiredContract),
      `Found retired database cutover contract: ${retiredContract}`
    );
  }

  assert.match(
    workflow,
    /\$COMPOSE run --rm -T --no-deps learning-os php artisan migrate --force < \/dev\/null/
  );
});

test('the production deployment wrapper and remote script remain valid Bash', async () => {
  const workflowPath = path.join(
    repositoryRoot,
    '.github/workflows/deploy-learning-os-prod.yml'
  );
  const workflow = YAML.parse(await readFile(workflowPath, 'utf8'));
  const deployStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Deploy Learning OS'
  );

  assert.equal(typeof deployStep?.run, 'string');
  await execFileAsync('bash', ['-n', '-c', deployStep.run]);

  const heredocMarker = "<< 'ENDSSH'";
  const heredocStart = deployStep.run.indexOf(heredocMarker);
  const remoteScriptStart = deployStep.run.indexOf('\n', heredocStart) + 1;
  const remoteScriptEnd = deployStep.run.indexOf('\nENDSSH\n', remoteScriptStart);

  assert.ok(heredocStart >= 0);
  assert.ok(remoteScriptStart > heredocStart);
  assert.ok(remoteScriptEnd > remoteScriptStart);
  await execFileAsync('bash', [
    '-n',
    '-c',
    deployStep.run.slice(remoteScriptStart, remoteScriptEnd),
  ]);
});

test('the production workflow verifies browser routes against Learning OS state', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'Browser Learning OS independent-state smoke check passed.',
    "'/api/study/browser?sortField=created_on&sortDirection=desc&limit=1'",
    'Browser detail Learning OS independent-state smoke check passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing post-cutover browser smoke contract: ${requiredContract}`
    );
  }

  const browserBlock = workflow.slice(
    workflow.indexOf("'Browser Learning OS'"),
    workflow.indexOf('Browser detail Learning OS independent-state smoke check passed.')
  );

  assert.match(
    browserBlock,
    /fetch_learning_os_route[\s\S]*?\/api\/study\/browser\?sortField=created_on/
  );
  assert.match(
    browserBlock,
    /Browser detail Learning OS[\s\S]*?\/api\/study\/browser\/\$browser_note_id/
  );
  assert.doesNotMatch(browserBlock, /\/api\/learning-os\/study\/browser|compare_read_route|ENABLE_/);
});

test('the auth lifecycle smoke exercises signup through account deletion with disposable state', async () => {
  const scriptPath = path.join(
    repositoryRoot,
    '.github/scripts/smoke-auth-signup-verification-lifecycle.sh'
  );
  const [script, workflow] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
  ]);

  await execFileAsync('bash', ['-n', scriptPath]);

  for (const requiredContract of requiredAuthLifecycleContracts) {
    assert.ok(script.includes(requiredContract), `Missing auth lifecycle contract: ${requiredContract}`);
  }

  assert.equal(
    [...script.matchAll(/session_get_json \\\n/g)].length,
    2,
    'Every authenticated JSON read should use the stateful session helper'
  );
  assert.equal(
    [...script.matchAll(/session_get_status \\\n/g)].length,
    2,
    'Every logged-out status check should use the stateful session helper'
  );

  const inviteCreate = script.indexOf('$invite->save();');
  const signup = script.indexOf("'/api/convolab/browser/auth/signup'");
  const accountRead = script.indexOf(
    'session_get_json \\\n  "$BASE_URL/api/convolab/auth/me"',
    signup
  );
  const profile = script.indexOf('--request PATCH', accountRead);
  const mailToken = script.indexOf('AUTH_SMOKE_TOKEN_COUNT=', profile);
  const verification = script.indexOf("'/api/convolab/browser/auth/verification'", mailToken);
  const login = script.indexOf("'/api/convolab/browser/auth/login'", verification);
  const logout = script.indexOf("'/api/convolab/browser/auth/logout'", login);
  const resetRequest = script.indexOf("'/api/auth/password/forgot'", logout);
  const queuedResetToken = script.indexOf('AUTH_SMOKE_RESET_TOKEN_COUNT=', resetRequest);
  const resetToken = script.indexOf('AUTH_SMOKE_RESET_TOKEN=', queuedResetToken);
  const reset = script.indexOf("'/api/auth/password/reset'", resetToken);
  const accountDelete = script.indexOf('--request DELETE', reset);
  const accountDeleteVerification = script.indexOf('AUTH_SMOKE_USER_COUNT=', accountDelete);
  const successCleanup = script.lastIndexOf('delete_disposable_account');

  assert.ok(inviteCreate >= 0);
  assert.ok(inviteCreate < signup);
  assert.ok(signup < accountRead);
  assert.ok(accountRead < profile);
  assert.ok(profile < mailToken);
  assert.ok(mailToken < verification);
  assert.ok(verification < login);
  assert.ok(login < logout);
  assert.ok(logout < resetRequest);
  assert.ok(resetRequest < queuedResetToken);
  assert.ok(queuedResetToken < resetToken);
  assert.ok(resetToken < reset);
  assert.ok(reset < accountDelete);
  assert.ok(accountDelete < accountDeleteVerification);
  assert.ok(accountDeleteVerification < successCleanup);

  const cleanupFunction = script.slice(
    script.indexOf('cleanup() {'),
    script.indexOf('trap cleanup EXIT')
  );
  assert.ok(
    cleanupFunction.indexOf('delete_disposable_account || cleanup_status=1') <
      cleanupFunction.indexOf('if [ "$cleanup_status" -ne 0 ]')
  );
  assert.ok(cleanupFunction.includes('if [ "$exit_status" -eq 0 ]; then'));
  assert.ok(cleanupFunction.includes('manual cleanup is required.'));
  assert.doesNotMatch(script, /ACTIVE_COLOR|SERVER_CONTAINER|convolab-server-/);
  assert.match(script, /"\$JSON_TOOLS_CONTAINER" node --input-type=module/);

  const serverHealthy = workflow.indexOf('wait_for_health "convolab-server-$active_color"');
  const authSmoke = workflow.indexOf(
    'bash .github/scripts/smoke-auth-signup-verification-lifecycle.sh',
    serverHealthy
  );

  assert.ok(serverHealthy >= 0);
  assert.ok(serverHealthy < authSmoke);
  assert.match(
    workflow.slice(serverHealthy, authSmoke),
    /JSON_TOOLS_CONTAINER="\$DEPLOYMENT_TOOLS_CONTAINER"/
  );
  assert.doesNotMatch(workflow, /LEARNING_OS_SCRIPT_PROXY_ENABLED|ROUTE_PROXY_CUTOVER_STARTED/);
});
