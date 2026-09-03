import assert from 'node:assert/strict';

const alwaysOnStudyContracts = [
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
];

const csrfReadinessContracts = [
  'wait_for_public_csrf() {',
  'local max_attempts=30',
  'for attempt in $(seq 1 "$max_attempts"); do',
  'Public Learning OS CSRF readiness attempt $attempt/$max_attempts failed.',
  'if [ "$attempt" -lt "$max_attempts" ]; then',
  'sleep 3',
  'if ! wait_for_public_csrf; then',
  'rm -f "$csrf_cookie_jar"',
];

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

const browserSmokeContracts = [
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
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertAlwaysOnContracts = (workflow) => {
  for (const contract of alwaysOnStudyContracts) {
    assert.match(workflow, new RegExp(escapeRegExp(contract)));
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
  assert.doesNotMatch(
    workflow,
    /enable_(?:settings|overview|browser|new_queue|review|card|media|daily_audio|imports)/
  );
  assert.doesNotMatch(
    workflow,
    /ENABLE_(?:SETTINGS|OVERVIEW|BROWSER|NEW_QUEUE|REVIEW|CARD|MEDIA|DAILY_AUDIO|IMPORTS)/
  );
  assert.doesNotMatch(workflow, /studyApi[A-Z]/);
  assert.doesNotMatch(workflow, /rollback_study_flags|flag_state|desired_parent/);
  assert.match(workflow, /fetch_learning_os_route\(\) \{/);
  assert.match(workflow, /mutate_learning_os_route\(\) \{/);
  assert.doesNotMatch(workflow, /\/api\/learning-os\/study/);
  assert.doesNotMatch(
    workflow,
    /\$COMPOSE up -d --no-deps --force-recreate learning-os learning-os-worker/
  );
};

const assertSessionAndCardOrder = (workflow) => {
  const directReadHelper = workflow.slice(
    workflow.indexOf('fetch_learning_os_route() {'),
    workflow.indexOf('mutate_learning_os_route() {')
  );
  const directMutationHelper = workflow.slice(
    workflow.indexOf('mutate_learning_os_route() {'),
    workflow.indexOf('content_browser_path() {')
  );
  for (const contract of [
    "--header 'Origin: https://convo-lab.com'",
    '--cookie "$content_browser_smoke_cookie_jar"',
  ]) {
    assert.ok(directReadHelper.includes(contract));
    assert.ok(directMutationHelper.includes(contract));
  }
  assert.ok(
    directMutationHelper.includes('--header "X-XSRF-TOKEN: $content_browser_smoke_csrf_token"')
  );
  assert.ok(directMutationHelper.includes('--cookie-jar "$content_browser_smoke_cookie_jar"'));
  assert.doesNotMatch(directReadHelper, /Authorization: Bearer/);
  assert.doesNotMatch(directMutationHelper, /Authorization: Bearer/);

  const browserSessionEstablished = workflow.indexOf(
    'Disposable Learning OS content browser session established.'
  );
  const directOverview = workflow.indexOf("'Overview Learning OS'");
  const importLifecycle = workflow.indexOf('bash .github/scripts/smoke-study-import-lifecycle.sh');
  const browserSessionCleanup = workflow.lastIndexOf(
    'cleanup_content_browser_smoke',
    workflow.indexOf('verify_study_api\n')
  );
  assert.ok(browserSessionEstablished < directOverview);
  assert.ok(directOverview < importLifecycle);
  assert.ok(importLifecycle < browserSessionCleanup);
  for (const contract of [
    'STUDY_SMOKE_USER_ID="$content_browser_smoke_user_id"',
    'STUDY_SMOKE_COOKIE_JAR="$content_browser_smoke_cookie_jar"',
    'STUDY_SMOKE_CSRF_TOKEN="$content_browser_smoke_csrf_token"',
  ]) {
    assert.ok(workflow.includes(contract));
  }
  const studyCardCreate = workflow.indexOf("'/api/study/cards'");
  const browserDetail = workflow.indexOf("'Browser detail Learning OS'");
  const queueReorder = workflow.indexOf("mutate_learning_os_route POST '/api/study/new-queue/reorder'");
  const studyCardDelete = workflow.indexOf('"/api/study/cards/$study_card_smoke_id"', queueReorder);
  assert.ok(studyCardCreate < browserDetail);
  assert.ok(browserDetail < queueReorder);
  assert.ok(queueReorder < studyCardDelete);
};

const assertReadinessAndCredentialOrder = (workflow) => {
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
  for (const contract of csrfReadinessContracts) {
    assert.ok(
      verifyStudyApi.includes(contract),
      `Missing production CSRF readiness contract: ${contract}`
    );
  }
  const publicCsrfWait = verifyStudyApi.indexOf('if ! wait_for_public_csrf; then');
  const csrfCookieRead = verifyStudyApi.indexOf('csrf_cookie_raw="$(awk');
  const invocation = workflow.indexOf('\n            verify_study_api\n');
  const activeServerHealthy = workflow.lastIndexOf(
    'wait_for_health "convolab-server-$active_color"',
    invocation
  );
  assert.ok(publicCsrfWait >= 0);
  assert.ok(publicCsrfWait < csrfCookieRead);
  assert.ok(activeServerHealthy >= 0);
  assert.ok(activeServerHealthy < invocation);

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
};

export const assertAlwaysOnStudyApiContracts = (workflow) => {
  assertAlwaysOnContracts(workflow);
  assertSessionAndCardOrder(workflow);
  assertReadinessAndCredentialOrder(workflow);
};

const assertPermanentRouteConfiguration = ({ compose, workflow, router, viteConfig }) => {
  for (const contract of retiredRolloutContracts) {
    assert.ok(!compose.includes(contract), `Retired compose flag remains: ${contract}`);
    assert.ok(!workflow.includes(contract), `Retired deployment flag remains: ${contract}`);
    assert.ok(!router.includes(contract), `Retired router flag remains: ${contract}`);
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
  for (const route of ['/api/feature-flags', '/api/convolab/browser/tools/analytics']) {
    assert.ok(router.includes(`location = ${route}`), `Missing direct router route: ${route}`);
    assert.ok(viteConfig.includes(`'${route}'`), `Missing direct Vite route: ${route}`);
    assert.ok(viteConfig.indexOf(`'${route}'`) < viteConfig.indexOf("'/api':"));
  }
};

const assertBrowserSmokeAndPublicGate = (workflow) => {
  for (const contract of browserSmokeContracts) {
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
};

const assertBrowserProbes = (workflow) => {
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
    assert.ok(probe.includes('Accept: application/json'));
    assert.ok(probe.includes("--header 'Origin: https://convo-lab.com'"));
  }
  const passwordProbeStart = workflow.indexOf('password_reset_status="$(curl', csrfProbeStart);
  const passwordProbeEnd = workflow.indexOf(')"', passwordProbeStart);
  const passwordProbe = workflow.slice(passwordProbeStart, passwordProbeEnd);
  assert.ok(passwordProbe.includes('--request POST'));
  assert.ok(passwordProbe.includes('--header "X-XSRF-TOKEN: $xsrf_token"'));
  assert.ok(passwordProbe.includes(`--data '{"email":"not-an-email"}'`));
  assert.ok(workflow.includes('if [ "$password_reset_status" != 422 ]; then'));
};

const assertRollbackContract = (workflow) => {
  const rollbackStart = workflow.indexOf('rollback_router() {');
  const rollbackEnd = workflow.indexOf('active_color="blue"', rollbackStart);
  const rollback = workflow.slice(rollbackStart, rollbackEnd);
  assert.ok(rollback.includes('render_router_config "$previous_color"'));
  assert.ok(!rollback.includes('direct_'));
};

export const assertPermanentBrowserApiContracts = (sources) => {
  assertPermanentRouteConfiguration(sources);
  assertBrowserSmokeAndPublicGate(sources.workflow);
  assertBrowserProbes(sources.workflow);
  assertRollbackContract(sources.workflow);
};
