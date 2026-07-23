import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('the deployment archive is a valid representative Anki collection', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'convolab-import-smoke-'));
  const archivePath = path.join(directory, 'smoke.colpkg');

  try {
    await execFileAsync('python3', [
      path.join(repositoryRoot, '.github/scripts/create-study-import-smoke-archive.py'),
      archivePath,
    ]);

    const archiveStat = await stat(archivePath);
    assert.ok(archiveStat.size > 32 * 1024 * 1024);

    const verification = await execFileAsync('python3', [
      '-c',
      `
import json, sqlite3, tempfile, zipfile
with zipfile.ZipFile(${JSON.stringify(archivePath)}) as archive:
    with tempfile.NamedTemporaryFile() as collection:
        collection.write(archive.read("collection.anki21"))
        collection.flush()
        database = sqlite3.connect(collection.name)
        counts = {
            table: database.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("notes", "cards", "revlog")
        }
        database.close()
    print(json.dumps({
        "entries": sorted(archive.namelist()),
        "mediaBytes": archive.getinfo("0").file_size,
        "counts": counts,
    }))
`,
    ]);

    assert.deepEqual(JSON.parse(verification.stdout), {
      entries: ['0', '1', 'collection.anki21', 'media'],
      mediaBytes: 32 * 1024 * 1024,
      counts: { notes: 2, cards: 3, revlog: 2 },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the staging workflow recovers the failed Audio Script media migration before retrying', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy.yml'),
    'utf8'
  );
  const migration = '20260719230000_extract_audio_script_media';
  const resolveIndex = workflow.indexOf(migration);
  const startIndex = workflow.indexOf('# Start containers');

  assert.ok(resolveIndex >= 0);
  assert.ok(workflow.includes('npx prisma migrate resolve --rolled-back "$failed_migration"'));
  assert.ok(startIndex > resolveIndex);
});

test('the production deployment configures and smokes Google OAuth', async () => {
  const [compose, workflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
  ]);

  for (const requiredComposeContract of [
    'GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}',
    'GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}',
    'GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}',
  ]) {
    assert.ok(compose.includes(requiredComposeContract), requiredComposeContract);
  }

  for (const requiredWorkflowContract of [
    'GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}',
    'GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}',
    'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets must be set',
    'GOOGLE_CLIENT_ID must not use the placeholder sentinel',
    "printf 'DEPLOY_GOOGLE_CLIENT_ID=%q\\n'",
    "printf 'DEPLOY_GOOGLE_CLIENT_SECRET=%q\\n'",
    '"$DROPLET_USER@$DROPLET_HOST" bash -s',
    'upsert_env GOOGLE_CLIENT_ID "$DEPLOY_GOOGLE_CLIENT_ID"',
    'upsert_env GOOGLE_CLIENT_SECRET "$DEPLOY_GOOGLE_CLIENT_SECRET"',
    'upsert_env GOOGLE_CALLBACK_URL https://convo-lab.com/api/auth/google/callback',
    'verify_public_google_oauth() {',
    'for attempt in {1..5}; do',
    'curl --max-time 10',
    'placeholder client ID is active',
    'https://convo-lab.com/api/auth/google',
    'oauth_location_lower="${oauth_location,,}"',
    "redirect_uri=https%3a%2f%2fconvo-lab.com%2fapi%2fauth%2fgoogle%2fcallback",
    'client_id=placeholder',
    'access_type=offline',
    'Google OAuth production redirect passed!',
  ]) {
    assert.ok(workflow.includes(requiredWorkflowContract), requiredWorkflowContract);
  }

  assert.ok(
    workflow.indexOf('upsert_env GOOGLE_CALLBACK_URL https://convo-lab.com/api/auth/google/callback') <
      workflow.indexOf('$COMPOSE pull')
  );
  const oauthGate = workflow.indexOf(
    'if ! verify_public_health || ! verify_public_google_oauth; then'
  );
  assert.ok(oauthGate >= 0);
  assert.ok(oauthGate < workflow.indexOf('write_active_color "$inactive_color"'));
  assert.ok(oauthGate < workflow.indexOf('Stopping old web color'));
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
    "mutate_proxy_route POST '/api/learning-os/study/session/start'",
    "mutate_proxy_route PATCH '/api/learning-os/study/settings'",
    "mutate_proxy_route POST '/api/learning-os/study/new-queue/reorder'",
    'bash .github/scripts/smoke-study-import-lifecycle.sh',
    'ensure_learning_os_service learning-os learning-os-api',
    'ensure_learning_os_worker',
    'current_image="$(docker inspect --format=\'{{.Config.Image}}\' "$container" 2>/dev/null || true)"',
    'current_proxy_user_email="$(docker inspect',
    '| sed -n \'s/^CONVOLAB_PROXY_USER_EMAIL=//p\'',
    'current_config_revision="$(docker inspect',
    '| sed -n \'s/^LEARNING_OS_DEPLOY_CONFIG_REVISION=//p\'',
    'desired_deploy_config_revision="password-reset-url-v2"',
    'upsert_env LEARNING_OS_DEPLOY_CONFIG_REVISION "$desired_deploy_config_revision"',
    '[ "$current_config_revision" = "$desired_deploy_config_revision" ]',
    'GCS_CREDENTIAL_PATH="server/gcloud-key.json"',
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
    /if \[ "\$current_image" = "\$desired_learning_os_image" \] \\\n\s+&& \[ "\$running" = true \] \\\n\s+&& \[ "\$current_proxy_user_email" = "\$SMOKE_USER_EMAIL" \] \\\n\s+&& \[ "\$current_config_revision" = "\$desired_deploy_config_revision" \] \\\n\s+&& \[ "\$current_auth_mail_config_revision" = "\$auth_mail_config_revision" \]; then/
  );
  assert.match(
    workflow,
    /if \[ "\$current_image" = "\$desired_learning_os_image" \] \\\n\s+&& \[ "\$running" = true \] \\\n\s+&& \[ "\$current_config_revision" = "\$desired_deploy_config_revision" \] \\\n\s+&& \[ "\$current_auth_mail_config_revision" = "\$auth_mail_config_revision" \] \\\n\s+&& \[\[ " \$current_command " == \*" \$desired_queue_argument "\* \]\]; then/
  );
  assert.doesNotMatch(workflow, /static-media-v2/);
  assert.doesNotMatch(workflow, /enable_(?:settings|overview|browser|new_queue|review|card|media|daily_audio|imports)/);
  assert.doesNotMatch(workflow, /ENABLE_(?:SETTINGS|OVERVIEW|BROWSER|NEW_QUEUE|REVIEW|CARD|MEDIA|DAILY_AUDIO|IMPORTS)/);
  assert.doesNotMatch(workflow, /studyApi[A-Z]/);
  assert.doesNotMatch(workflow, /rollback_study_flags|flag_state|desired_parent/);
  assert.doesNotMatch(workflow, /['"]\/api\/study\/(?:settings|overview|browser|new-queue)/);
  assert.doesNotMatch(workflow, /\/api\/daily-audio-practice/);
  assert.doesNotMatch(
    workflow,
    /\$COMPOSE up -d --no-deps --force-recreate learning-os learning-os-worker/
  );

  const verifyStudyApi = workflow.slice(
    workflow.indexOf('verify_study_api() {'),
    workflow.indexOf('fetch_read_route() {')
  );
  const postgresUserAssignment = verifyStudyApi.indexOf(
    'postgres_user="$(sed -n \'s/^POSTGRES_USER=//p\' .env.production | tail -1)"'
  );
  const postgresUserUse = verifyStudyApi.indexOf('--username="$postgres_user"');

  assert.ok(postgresUserAssignment >= 0);
  assert.ok(postgresUserUse > postgresUserAssignment);

  for (const requiredContract of [
    'wait_for_public_csrf() {',
    'for attempt in {1..12}; do',
    'Public ConvoLab CSRF readiness attempt $attempt/12 failed.',
    'if [ "$attempt" -lt 12 ]; then',
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

  const credentialCheck = workflow.indexOf('if [ ! -s "$GCS_CREDENTIAL_PATH" ]; then');
  const imagePull = workflow.indexOf('timeout 600 $COMPOSE pull learning-os learning-os-worker');
  const migration = workflow.indexOf(
    '$COMPOSE run --rm -T --no-deps learning-os php artisan migrate --force'
  );

  assert.ok(credentialCheck >= 0);
  assert.ok(imagePull > credentialCheck);
  assert.ok(migration > credentialCheck);
});

test('the production workflow refreshes and verifies Learning OS content reads', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'php artisan content:import-convolab-episodes',
    '--source-database="$source_db"',
    '--production-truncate-confirmation="TRUNCATE $TARGET_DB"',
    "'Episode list Learning OS'",
    "'/api/episodes?library=true&limit=1&offset=0'",
    "'Episode detail Learning OS'",
    'Episode Learning OS read smoke checks passed.',
    "'Course list Learning OS'",
    "'/api/courses?library=true&limit=1&offset=0'",
    "'Course detail Learning OS'",
    'Course Learning OS read smoke checks passed.',
  ]) {
    assert.ok(workflow.includes(requiredContract), requiredContract);
  }

  const migration = workflow.indexOf('php artisan migrate --force');
  const episodeImport = workflow.indexOf('php artisan content:import-convolab-episodes');
  const tokenCutover = workflow.indexOf('PROXY_TOKEN_CUTOVER_STARTED=true');
  const episodeSmoke = workflow.indexOf('Episode Learning OS read smoke checks passed.');
  const courseSmoke = workflow.indexOf('Course Learning OS read smoke checks passed.');

  assert.ok(migration >= 0);
  assert.ok(migration < episodeImport);
  assert.ok(episodeImport < tokenCutover);
  assert.ok(tokenCutover < episodeSmoke);
  assert.ok(episodeSmoke < courseSmoke);
});

test('the production workflow proves public course CRUD and removes every smoke artifact', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'course_write_smoke_marker="$(cat /proc/sys/kernel/random/uuid)"',
    "course_create=\"$(mutate_proxy_route POST '/api/courses'",
    'course_write_smoke_id=',
    '"/api/courses/$course_write_smoke_id"',
    'response?.message !== "Course updated successfully"',
    "'Updated course Learning OS'",
    'course.description !== null',
    'course.maxLessonDurationMinutes !== 45',
    'response?.message !== "Course deleted successfully"',
    'Deleted smoke course still exists.',
    'Deleted smoke course has no tombstone.',
    'cleanup_course_write_smoke() {',
    'if ($courseIds !== [] || $episodeIds !== []) {',
    'COURSE_WRITE_SMOKE_REMAINING=',
    'cleanup_course_write_smoke best-effort',
    'Course Learning OS CRUD smoke check passed.',
  ]) {
    assert.ok(workflow.includes(requiredContract), `Missing course CRUD smoke: ${requiredContract}`);
  }

  const marker = workflow.indexOf('course_write_smoke_marker="$(cat /proc/sys/kernel/random/uuid)"');
  const create = workflow.indexOf("course_create=\"$(mutate_proxy_route POST '/api/courses'");
  const update = workflow.indexOf('course_update="$(mutate_proxy_route');
  const detail = workflow.indexOf("'Updated course Learning OS'");
  const deleteCourse = workflow.indexOf('course_delete="$(mutate_proxy_route');
  const tombstone = workflow.indexOf('Deleted smoke course has no tombstone.');
  const cleanup = workflow.lastIndexOf(
    'cleanup_course_write_smoke',
    workflow.indexOf('Course Learning OS CRUD smoke check passed.')
  );
  const complete = workflow.indexOf('Course Learning OS CRUD smoke check passed.');

  assert.ok(marker >= 0);
  assert.ok(marker < create);
  assert.ok(create < update);
  assert.ok(update < detail);
  assert.ok(detail < deleteCourse);
  assert.ok(deleteCourse < tombstone);
  assert.ok(tombstone < cleanup);
  assert.ok(cleanup < complete);

  const failureCleanup = workflow.slice(
    workflow.indexOf('cleanup_deployment_failure() {'),
    workflow.indexOf('trap cleanup_deployment_failure EXIT')
  );
  assert.ok(failureCleanup.includes('cleanup_course_write_smoke best-effort'));
});

test('the production workflow proves public episode CRUD and removes every smoke artifact', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'episode_write_smoke_marker="$(cat /proc/sys/kernel/random/uuid)"',
    "episode_create=\"$(mutate_proxy_route POST '/api/episodes'",
    'episode_write_smoke_id=',
    '"/api/episodes/$episode_write_smoke_id"',
    'response?.message !== "Episode updated successfully"',
    "'Updated episode Learning OS'",
    'episode.sourceText !== "Disposable production episode rehearsal source text."',
    'episode.status !== "ready"',
    'response?.message !== "Episode deleted successfully"',
    'Deleted smoke episode still exists.',
    'cleanup_episode_write_smoke() {',
    'EPISODE_WRITE_SMOKE_REMAINING=',
    'cleanup_episode_write_smoke best-effort',
    'Episode Learning OS CRUD smoke check passed.',
  ]) {
    assert.ok(workflow.includes(requiredContract), `Missing episode CRUD smoke: ${requiredContract}`);
  }

  const marker = workflow.indexOf('episode_write_smoke_marker="$(cat /proc/sys/kernel/random/uuid)"');
  const create = workflow.indexOf("episode_create=\"$(mutate_proxy_route POST '/api/episodes'");
  const update = workflow.indexOf('episode_update="$(mutate_proxy_route');
  const detail = workflow.indexOf("'Updated episode Learning OS'");
  const deleteEpisode = workflow.indexOf('episode_delete="$(mutate_proxy_route');
  const deleted = workflow.indexOf('Deleted smoke episode still exists.');
  const cleanup = workflow.lastIndexOf(
    'cleanup_episode_write_smoke',
    workflow.indexOf('Episode Learning OS CRUD smoke check passed.')
  );
  const complete = workflow.indexOf('Episode Learning OS CRUD smoke check passed.');

  assert.ok(marker >= 0);
  assert.ok(marker < create);
  assert.ok(create < update);
  assert.ok(update < detail);
  assert.ok(detail < deleteEpisode);
  assert.ok(deleteEpisode < deleted);
  assert.ok(deleted < cleanup);
  assert.ok(cleanup < complete);

  const failureCleanup = workflow.slice(
    workflow.indexOf('cleanup_deployment_failure() {'),
    workflow.indexOf('trap cleanup_deployment_failure EXIT')
  );
  assert.ok(failureCleanup.includes('cleanup_episode_write_smoke best-effort'));
});

test('the production stack wires and smokes Learning OS static media', async () => {
  const compose = await readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );
  const stageCompose = await readFile(
    path.join(repositoryRoot, 'docker-compose.stage.yml'),
    'utf8'
  );

  for (const requiredComposeContract of [
    'LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED: ${LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED:-true}',
    'LEARNING_OS_DEPLOY_CONFIG_REVISION: ${LEARNING_OS_DEPLOY_CONFIG_REVISION}',
    'GOOGLE_APPLICATION_CREDENTIALS: /app/gcloud-key.json',
    'GCS_BUCKET_NAME: ${GCS_BUCKET_NAME}',
    'AVATARS_GCS_ROOT: ${AVATARS_GCS_ROOT:-avatars}',
    'AVATAR_SIGNED_URLS_ENABLED: ${AVATAR_SIGNED_URLS_ENABLED:-true}',
    'TOOLS_AUDIO_GCS_ROOT: ${TOOLS_AUDIO_GCS_ROOT:-tools-audio}',
    'TOOLS_AUDIO_SIGNED_URLS_ENABLED: ${TOOLS_AUDIO_SIGNED_URLS_ENABLED:-true}',
    '- ./server/gcloud-key.json:/app/gcloud-key.json:ro',
  ]) {
    assert.ok(compose.includes(requiredComposeContract), requiredComposeContract);
  }

  const serverEnvironment = compose.slice(
    compose.indexOf('x-server-environment:'),
    compose.indexOf('x-server-service:')
  );
  assert.ok(serverEnvironment.includes('AVATARS_GCS_ROOT: ${AVATARS_GCS_ROOT:-avatars}'));
  assert.ok(
    serverEnvironment.includes('TOOLS_AUDIO_GCS_ROOT: ${TOOLS_AUDIO_GCS_ROOT:-tools-audio}')
  );

  assert.match(
    stageCompose,
    /LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED:\s*['"]false['"]/
  );

  for (const requiredSmokeContract of [
    'test "$active_static_media_proxy" = true',
    "'https://convo-lab.com/api/avatars/voices/ja-shohei.jpg'",
    'Avatar Learning OS proxy smoke check passed.',
    "'/api/tools-audio/signed-urls'",
    'Tool Audio Learning OS proxy smoke check passed.',
  ]) {
    assert.ok(workflow.includes(requiredSmokeContract), requiredSmokeContract);
  }
});

test('generation routes are permanently proxied and production rehearsals cover them', async () => {
  const [localCompose, stageCompose, productionCompose, workflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
  ]);

  const retiredProxyFlags =
    /LEARNING_OS_(?:COURSE_GENERATION|DIALOGUE_GENERATION|AUDIO_GENERATION|SCRIPT|AUTH|PROFILE|SIGNUP|VERIFICATION)_PROXY_ENABLED/;
  for (const source of [localCompose, stageCompose, productionCompose, workflow]) {
    assert.doesNotMatch(source, retiredProxyFlags);
  }
  assert.doesNotMatch(stageCompose, /MONTHLY_GENERATION_LIMIT/);
  assert.doesNotMatch(productionCompose, /MONTHLY_GENERATION_LIMIT/);

  for (const requiredContract of [
    '"content:write"',
    'if [ "$cleanup_failed" = true ]; then',
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"',
    '"auth:login"',
    '"auth:read"',
    '"auth:write"',
    '"auth:signup"',
    '"auth:verification"',
    '"auth:oauth"',
    "fetch_read_route 'Auth current user Learning OS' '/api/auth/me'",
    '-e EXPECTED_USER_ROLE="$user_role"',
    'account.role !== process.env.EXPECTED_USER_ROLE',
    'Auth current-user Learning OS proxy smoke check passed.',
    "fetch_read_route 'Generation quota Learning OS' '/api/auth/me/quota'",
    'quota.remaining !== Math.max(0, quota.limit - quota.used)',
    'Generation quota Learning OS proxy smoke check passed.',
    'PROFILE_SMOKE_CHANGED=true',
    "PATCH '/api/auth/me' \"$profile_smoke_probe_body\"",
    'cleanup_profile_smoke',
    'Auth profile Learning OS proxy smoke check passed and restored.',
    'bash .github/scripts/smoke-auth-signup-verification-lifecycle.sh',
    'script_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'script_smoke_inserted=true',
    'cleanup_script_smoke best-effort',
    '"/api/scripts/$script_smoke_episode_id/status"',
    '"/api/scripts/job/$script_smoke_job_id"',
    '"https://convo-lab.com/api/scripts/media/$script_smoke_media_id"',
    '"https://convo-lab.com/api/scripts/$script_smoke_episode_id/audio/$script_smoke_render_id"',
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
    '"/api/courses/$course_generation_smoke_id/reset"',
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
    '"/api/dialogue/job/$dialogue_generation_smoke_job_id"',
    'cleanup_dialogue_generation_smoke best-effort',
    'Dialogue generation Learning OS routing smoke check passed.',
    'image_generation_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_dialogue_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_job_id="$(cat /proc/sys/kernel/random/uuid)"',
    'image_generation_smoke_inserted=true',
    'DB::table("content_image_generation_jobs")->insert',
    '"state" => App\\Domain\\Content\\Support\\ContentImageGeneration::STATE_ACTIVE',
    "'/api/images/generate'",
    '"/api/images/job/$image_generation_smoke_job_id"',
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
    '"/api/audio/job/$audio_generation_smoke_job_id"',
    '"https://convo-lab.com/api/convolab/episodes/$audio_generation_smoke_episode_id/audio/1.0"',
    'cleanup_audio_generation_smoke best-effort',
    'Audio generation Learning OS routing and streaming smoke checks passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing permanent generation proxy contract: ${requiredContract}`
    );
  }

  const tokenScope = workflow.indexOf('"content:write"');
  const serverRestart = workflow.indexOf(
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"'
  );
  const fixtureInsert = workflow.indexOf(
    'Illuminate\\Support\\Facades\\DB::table("content_courses")->insert'
  );
  const csrfTokenInitialization = workflow.indexOf('csrf_token="$(docker exec');
  const publicReset = workflow.indexOf('"/api/courses/$course_generation_smoke_id/reset"');
  const statusCheck = workflow.indexOf("'Course generation status after reset'");
  const successCleanup = workflow.lastIndexOf(
    'cleanup_course_generation_smoke',
    workflow.indexOf('Course generation Learning OS write smoke check passed.')
  );

  assert.ok(tokenScope >= 0);
  assert.ok(tokenScope < serverRestart);
  assert.ok(serverRestart < csrfTokenInitialization);
  assert.ok(csrfTokenInitialization < fixtureInsert);
  assert.ok(fixtureInsert < publicReset);
  assert.ok(publicReset < statusCheck);
  assert.ok(statusCheck < successCleanup);

  const fixtureInserted = workflow.indexOf('course_generation_smoke_inserted=true');
  assert.ok(serverRestart < fixtureInserted);
  assert.ok(fixtureInserted < fixtureInsert);

  const failureCleanup = workflow.slice(
    workflow.indexOf('cleanup_deployment_resources() {'),
    workflow.indexOf('trap cleanup_deployment_resources EXIT')
  );
  assert.doesNotMatch(failureCleanup, retiredProxyFlags);
  assert.ok(failureCleanup.includes('cleanup_profile_smoke best-effort'));
});

test('ConvoLab queue workers are retired from runtime and deployment surfaces', async () => {
  const [stageCompose, productionCompose, stageWorkflow, productionWorkflow, scriptWorkflow] =
    await Promise.all([
      readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/deploy.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
      readFile(path.join(repositoryRoot, '.github/workflows/run-script-prod.yml'), 'utf8'),
    ]);
  const serverPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, 'server/package.json'), 'utf8')
  );

  assert.equal(serverPackage.dependencies.bullmq, undefined);
  assert.doesNotMatch(stageCompose, /^\s+worker-stage:/m);
  assert.doesNotMatch(productionCompose, /^\s+worker:/m);
  assert.doesNotMatch(
    stageWorkflow,
    /Dockerfile\.worker|convolab-\$\{\{ matrix\.name \}\}|convolab-worker-stage/
  );
  assert.doesNotMatch(productionWorkflow, /\$COMPOSE pull[^\n]*\bworker\b/);
  assert.doesNotMatch(
    productionWorkflow,
    /force-recreate worker|worker_state=|convolab-worker/
  );
  assert.doesNotMatch(scriptWorkflow, /^\s+- worker$/m);

  await assert.rejects(stat(path.join(repositoryRoot, 'server/Dockerfile.worker')));
  await assert.rejects(stat(path.join(repositoryRoot, 'server/src/worker.ts')));
});

test('legacy direct dialogue generation stays retired behind the Learning OS proxy', async () => {
  const route = await readFile(path.join(repositoryRoot, 'server/src/routes/dialogue.ts'), 'utf8');
  const retiredPaths = [
    'server/src/services/dialogueGenerator.ts',
    'server/scripts/create-and-generate-dialog-for-yuriy.ts',
    'server/scripts/generate-all-sample-dialogues.ts',
    'server/scripts/generate-sample-dialogues.ts',
    'server/scripts/recreate-dialog-longer.ts',
  ];

  assert.match(route, /generateLearningOsDialogue/);
  assert.match(route, /showLearningOsDialogueJob/);
  assert.doesNotMatch(route, /dialogueGenerator/);

  for (const retiredPath of retiredPaths) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }
});

test('legacy direct dialogue audio generation stays retired behind the Learning OS proxy', async () => {
  const route = await readFile(path.join(repositoryRoot, 'server/src/routes/audio.ts'), 'utf8');
  const retiredPaths = [
    'server/src/services/audioGenerator.ts',
    'server/scripts/generate-sample-audio.ts',
    'server/scripts/manual-audio-generation.ts',
  ];

  assert.match(route, /generateLearningOsAudio/);
  assert.match(route, /generateAllSpeedsLearningOsAudio/);
  assert.match(route, /showLearningOsAudioJob/);
  assert.doesNotMatch(route, /audioGenerator/);

  for (const retiredPath of retiredPaths) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }
});

test('legacy direct lesson generation stays retired behind the Learning OS course proxy', async () => {
  const route = await readFile(path.join(repositoryRoot, 'server/src/routes/courses.ts'), 'utf8');
  const retiredPaths = [
    'server/src/services/conversationalLessonScriptGenerator.ts',
    'server/src/services/speakerNarration.ts',
    'server/src/services/scriptGenerationConfig.ts',
    'server/src/services/scriptProofreader.ts',
  ];

  assert.match(route, /generateLearningOsCourse/);
  assert.match(route, /showLearningOsCourseGenerationStatus/);
  assert.match(route, /retryLearningOsCourseGeneration/);
  assert.doesNotMatch(route, /conversationalLessonScriptGenerator|scriptProofreader/);

  for (const retiredPath of retiredPaths) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }
});

test('legacy audio script generation stays retired behind the Learning OS script proxy', async () => {
  const route = await readFile(path.join(repositoryRoot, 'server/src/routes/scripts.ts'), 'utf8');
  const retiredPaths = [
    'server/src/services/audioScriptService.ts',
    'server/src/services/audioCourseAssembler.ts',
  ];

  for (const handler of [
    'storeLearningOsScript',
    'annotateLearningOsScript',
    'updateLearningOsScriptSegments',
    'renderLearningOsScript',
    'generateLearningOsScriptImages',
    'showLearningOsScript',
    'showLearningOsScriptJob',
    'streamLearningOsScriptImage',
    'streamLearningOsScriptAudio',
  ]) {
    assert.match(route, new RegExp(`\\b${handler}\\b`));
  }
  assert.doesNotMatch(route, /audioScriptService|audioCourseAssembler/);

  for (const retiredPath of retiredPaths) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }
});

test('legacy lesson planning and script generation stay retired behind Learning OS', async () => {
  const courseRoute = await readFile(
    path.join(repositoryRoot, 'server/src/routes/courses.ts'),
    'utf8'
  );
  const scriptTypes = await readFile(
    path.join(repositoryRoot, 'server/src/services/lessonScriptTypes.ts'),
    'utf8'
  );
  const retiredPaths = [
    'server/src/services/lessonScriptGenerator.ts',
    'server/src/services/lessonPlanner.ts',
  ];

  assert.match(courseRoute, /generateLearningOsCourse/);
  assert.doesNotMatch(courseRoute, /lessonScriptGenerator|lessonPlanner/);
  assert.match(scriptTypes, /export type LessonScriptUnit/);
  assert.doesNotMatch(scriptTypes, /generateCoreLlm|planCourse|generateLessonScript/);

  for (const retiredPath of retiredPaths) {
    await assert.rejects(stat(path.join(repositoryRoot, retiredPath)));
  }
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
    '"auth:signup"',
    '"auth:verification"',
    '"auth:oauth"',
    '-e EXPECTED_CLIENT_URL="$client_url"',
    '-e EXPECTED_ADMIN_EMAILS="$admin_emails"',
    '-e EXPECTED_MAIL_FROM_ADDRESS="$mail_from_address"',
    '-e EXPECTED_MAIL_FROM_NAME="$mail_from_name"',
    'config("mail.default") !== "resend"',
    'blank(config("services.resend.key"))',
    'config("services.convolab.admin_emails") !== $expectedAdminEmails',
    'Learning OS auth mail configuration is incomplete.',
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
  const imagePull = workflow.indexOf('timeout 600 $COMPOSE pull learning-os learning-os-worker');
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

test('the production workflow verifies and cleans up a disposable card draft', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    "mutate_proxy_route POST '/api/learning-os/study/card-drafts'",
    "'/api/learning-os/study/card-drafts?limit=200'",
    '"/api/learning-os/study/card-drafts/$draft_id"',
    'card_draft_smoke_id="$draft_id"',
    '"/api/learning-os/study/card-drafts/$card_draft_smoke_id"',
    'card_draft_smoke_id=',
    'Study card draft lifecycle smoke check passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing card-draft contract: ${requiredContract}`
    );
  }

  assert.ok(
    workflow.indexOf('mutate_proxy_route DELETE') <
      workflow.indexOf('Study card draft lifecycle smoke check passed.')
  );
});

test('the production workflow streams and cleans up disposable Learning OS media', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'cleanup_media_smoke',
    'cleanup_deployment_failure() {\n              exit_code=$?\n              set +e',
    'if (! $disk->put($path, $contents))',
    'App\\Domain\\Media\\Models\\MediaAsset::query()->create',
    '[[ "$media_smoke_id" =~ ^[0-9a-hjkmnp-tv-z]{26}$ ]]',
    'Learning OS returned an invalid media smoke ULID:',
    '"https://convo-lab.com/api/learning-os/study/media/$media_smoke_id"',
    'Study media streaming smoke check passed.',
  ]) {
    assert.ok(workflow.includes(requiredContract), `Missing media contract: ${requiredContract}`);
  }

  const mediaSmokeBlock = workflow.slice(
    workflow.indexOf('media_smoke_output='),
    workflow.indexOf('ACTIVE_COLOR="$active_color"')
  );
  assert.doesNotMatch(mediaSmokeBlock, /\^\[0-9A-HJKMNP-TV-Z\]\{26\}\$/);
  const failureCleanupBlock = workflow.slice(
    workflow.indexOf('cleanup_deployment_failure() {'),
    workflow.indexOf('trap cleanup_deployment_failure EXIT')
  );
  assert.doesNotMatch(failureCleanupBlock, /rollback_study_flags|feature.flags?/i);
  assert.match(failureCleanupBlock, /cleanup_deployment_resources/);
  const mediaRequestIndex = workflow.indexOf(
    '"https://convo-lab.com/api/learning-os/study/media/$media_smoke_id"'
  );
  const mediaPassedIndex = workflow.indexOf('Study media streaming smoke check passed.');
  const cleanupInvocationIndex = workflow.lastIndexOf(
    'cleanup_media_smoke',
    mediaPassedIndex
  );
  assert.ok(
    mediaRequestIndex < cleanupInvocationIndex && cleanupInvocationIndex < mediaPassedIndex
  );
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

test('the production workflow verifies migrated Daily Audio through Learning OS', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    "'/api/learning-os/study/daily-audio-practice'",
    'Daily Audio historical track lookup',
    'No historical ready Daily Audio practice is available for streaming verification.',
    `printf '%s' "$daily_audio_list" | docker exec -i`,
    `printf '%s' "$daily_audio_detail" | docker exec -i`,
    `printf '%s' "$daily_audio_status" | docker exec -i`,
    'for await (const chunk of process.stdin) chunks.push(chunk);',
    'daily_audio_smoke_body="$(mktemp)"',
    '"https://convo-lab.com$daily_audio_track_url"',
    "grep -Eiq '^content-type: audio/mpeg([[:space:]]|$)'",
    "grep -Eiq \"^content-security-policy: sandbox; default-src 'none'[[:space:]]*$\"",
    "grep -Eiq '^cross-origin-resource-policy: same-origin[[:space:]]*$'",
    "grep -Eiq '^x-content-type-options: nosniff[[:space:]]*$'",
    'cleanup_daily_audio_smoke',
    'Historical Daily Audio streaming smoke check passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing Daily Audio cutover contract: ${requiredContract}`
    );
  }

  const dailyAudioBlock = workflow.slice(
    workflow.indexOf('daily_audio_list='),
    workflow.indexOf("'Browser Learning OS'")
  );
  assert.ok(
    dailyAudioBlock.indexOf('if [ -z "$daily_audio_id" ]; then') <
      dailyAudioBlock.indexOf('Daily Audio historical track lookup')
  );
  assert.doesNotMatch(dailyAudioBlock, /if \[ -n "\$daily_audio_id" \]; then/);
  assert.doesNotMatch(
    dailyAudioBlock,
    /DAILY_AUDIO_(?:RESPONSE|DETAIL|STATUS)=/,
    'Daily Audio JSON must use stdin so large production payloads cannot exceed ARG_MAX'
  );
  assert.ok(
    dailyAudioBlock.indexOf('Daily Audio historical track lookup') <
      dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.')
  );
  assert.ok(
    dailyAudioBlock.indexOf('test -s "$daily_audio_smoke_body"') <
      dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.')
  );
});

test('the production worker consumes Learning OS card-draft jobs', async () => {
  const compose = await readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');

  assert.match(compose, /['"]--queue=study-imports,study-card-drafts,default['"]/);
  assert.match(
    compose,
    /x-learning-os-environment:[\s\S]*OPENAI_API_KEY: \$\{OPENAI_API_KEY\}[\s\S]*STUDY_CARD_GENERATOR_MODEL: \$\{STUDY_CARD_GENERATOR_MODEL:-gpt-5\.5\}[\s\S]*STUDY_CARD_GENERATOR_REASONING_EFFORT: \$\{STUDY_CARD_GENERATOR_REASONING_EFFORT:-medium\}[\s\S]*STUDY_CARD_IMAGE_GENERATOR_MODEL: \$\{STUDY_CARD_IMAGE_GENERATOR_MODEL:-gpt-image-1\}[\s\S]*FISH_AUDIO_API_KEY: \$\{FISH_AUDIO_API_KEY\}[\s\S]*FISH_AUDIO_API_BASE_URL: \$\{FISH_AUDIO_API_BASE_URL:-https:\/\/api\.fish\.audio\}[\s\S]*FISH_AUDIO_BACKEND: \$\{FISH_AUDIO_BACKEND:-s1\}/
  );
});

test('the production workflow verifies browser routes against Learning OS state', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'Browser Learning OS independent-state smoke check passed.',
    "'/api/learning-os/study/browser?sortField=created_on&sortDirection=desc&limit=1'",
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
    /fetch_read_route[\s\S]*?\/api\/learning-os\/study\/browser\?sortField=created_on/
  );
  assert.match(
    browserBlock,
    /Browser detail Learning OS[\s\S]*?\/api\/learning-os\/study\/browser\/\$browser_note_id/
  );
  assert.doesNotMatch(browserBlock, /\/api\/study\/browser|compare_read_route|ENABLE_/);
});

test('the production workflow overlaps proxy tokens through a healthy server cutover', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'NEW_PROXY_TOKEN_ID=""',
    'PROXY_TOKEN_CUTOVER_STARTED=false',
    'if [ -n "$NEW_PROXY_TOKEN_ID" ] && [ "$PROXY_TOKEN_CUTOVER_STARTED" != true ]; then',
    '"study:read",',
    '"study:write",',
    '"feature-flags:read",',
    '"feature-flags:write",',
    '"auth:oauth",',
    '"tools:analytics",',
    'echo "PROXY_TOKEN_ID=".$accessToken->accessToken->getKey().PHP_EOL;',
    'echo "PROXY_TOKEN=".$accessToken->plainTextToken.PHP_EOL;',
    'upsert_env LEARNING_OS_API_TOKEN "$proxy_token"',
    'PROXY_TOKEN_CUTOVER_STARTED=true',
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"',
    'wait_for_health "convolab-server-$active_color"',
    'test "$active_proxy_token" = "$proxy_token"',
    "'https://convo-lab.com/api/tools/analytics'",
    '[ "$tool_analytics_status" != 204 ]',
    'Tool Analytics Learning OS proxy smoke check passed.',
    'if ! docker exec',
    '->where("id", "!=", getenv("CONVOLAB_PROXY_TOKEN_ID"))',
    'Unable to prune older Learning OS proxy tokens; a later deployment will retry.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing token rotation contract: ${requiredContract}`
    );
  }

  const tokenCreation = workflow.indexOf(
    '$accessToken = $user->createToken("convolab-proxy", ['
  );
  const tokenConfigured = workflow.indexOf(
    'upsert_env LEARNING_OS_API_TOKEN "$proxy_token"',
    tokenCreation
  );
  const cutoverStarted = workflow.indexOf('PROXY_TOKEN_CUTOVER_STARTED=true', tokenConfigured);
  const serverRestarted = workflow.indexOf(
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"',
    cutoverStarted
  );
  const serverHealthy = workflow.indexOf(
    'wait_for_health "convolab-server-$active_color"',
    serverRestarted
  );
  const tokenInstalled = workflow.indexOf(
    'test "$active_proxy_token" = "$proxy_token"',
    serverHealthy
  );
  const toolAnalyticsSmoke = workflow.indexOf(
    'Tool Analytics Learning OS proxy smoke check passed.',
    tokenInstalled
  );
  const oldTokensPruned = workflow.indexOf(
    '->where("id", "!=", getenv("CONVOLAB_PROXY_TOKEN_ID"))',
    tokenInstalled
  );

  assert.ok(tokenCreation >= 0);
  assert.ok(tokenCreation < tokenConfigured);
  assert.ok(tokenConfigured < cutoverStarted);
  assert.ok(cutoverStarted < serverRestarted);
  assert.ok(serverRestarted < serverHealthy);
  assert.ok(serverHealthy < tokenInstalled);
  assert.ok(tokenInstalled < oldTokensPruned);
  assert.ok(oldTokensPruned < toolAnalyticsSmoke);
  assert.doesNotMatch(
    workflow.slice(tokenCreation, serverHealthy),
    /tokens\(\).*->delete\(\)/s,
    'The active proxy token must not be revoked before the replacement server is healthy'
  );
});

test('the lifecycle smoke script remains valid Bash', async () => {
  const scriptPath = path.join(
    repositoryRoot,
    '.github/scripts/smoke-study-import-lifecycle.sh'
  );
  const script = await readFile(scriptPath, 'utf8');

  await execFileAsync('bash', ['-n', scriptPath]);

  for (const requiredContract of [
    'trap cleanup EXIT',
    'RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"',
    'docker logs --since "$RUN_STARTED_AT" --tail=300 learning-os-worker',
    'delete_learning_os_smoke_user',
    'delete_convolab_smoke_user',
    'restore_proxy_identity',
    'wait_for_public_csrf',
    'for attempt in {1..12}; do',
    'Public ConvoLab CSRF readiness attempt $attempt/12 failed; retrying.',
    '--cookie "token=$auth_token"',
    '--cookie-jar "$CSRF_COOKIE_JAR"',
    "'https://convo-lab.com/api/auth/csrf'",
    'docker exec -e IMPORT_SMOKE_EMAIL="$SMOKE_EMAIL" learning-os-api',
    '/api/learning-os/study/imports/readiness',
    "/api/learning-os/study/imports'",
    '/api/learning-os/study/imports/$import_job_id/upload',
    'archive_sha256="$(sha256sum "$ARCHIVE_PATH"',
    'IMPORT_SMOKE_SHA256=',
    'Uploaded import archive checksum mismatch:',
    '/api/learning-os/study/imports/$import_job_id/complete',
    '/api/learning-os/study/imports/$import_job_id',
    '/api/learning-os/study/imports/$cancel_job_id/cancel',
    'response.data.summary.imported_cards',
  ]) {
    assert.ok(script.includes(requiredContract), `Missing lifecycle contract: ${requiredContract}`);
  }

  const temporaryServerRestart = script.indexOf(
    '$COMPOSE up -d --no-deps --force-recreate "server-$ACTIVE_COLOR"',
    script.indexOf('upsert_env LEARNING_OS_PROXY_USER_EMAIL "$SMOKE_EMAIL"')
  );
  const containerHealthy = script.indexOf('wait_for_health "$SERVER_CONTAINER"', temporaryServerRestart);
  const publicCsrfReady = script.indexOf('wait_for_public_csrf', containerHealthy);
  const csrfCookieRead = script.indexOf('csrf_cookie_raw="$(awk', publicCsrfReady);

  assert.ok(temporaryServerRestart >= 0);
  assert.ok(temporaryServerRestart < containerHealthy);
  assert.ok(containerHealthy < publicCsrfReady);
  assert.ok(publicCsrfReady < csrfCookieRead);
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

  for (const requiredContract of [
    'trap cleanup EXIT',
    'trap report_error ERR',
    'Auth lifecycle command failed at line $failed_line with exit status $exit_status.',
    'delete_disposable_account',
    'source_system", ConvoLabAccountSource::LEARNING_OS',
    'convolab_email_verification_tokens',
    'password_reset_tokens',
    'Auth lifecycle failed and disposable-state cleanup also failed; manual cleanup is required.',
    'SMOKE_EMAIL="${smoke_local_part}+learning-os-smoke-',
    'POST $path failed before receiving an HTTP response.',
    'POST $path returned HTTP $status${retry_after:+ (Retry-After: $retry_after seconds)}.',
    'Response body (first 4096 bytes):',
    "'/api/auth/signup'",
    'response.emailVerified',
    'prisma.user.count',
    'AUTH_SMOKE_TOKEN_COUNT=',
    'if token_count="$(docker exec',
    'Verification mail token query attempt $attempt/30 failed; retrying.',
    'IssueConvoLabVerificationTokenAction::class',
    '$BASE_URL/api/verification/$verification_token',
    "'/api/auth/login'",
    "'/api/password-reset/request'",
    'AUTH_SMOKE_RESET_TOKEN_COUNT=',
    'if reset_token_count="$(docker exec',
    'Password reset token query attempt $attempt/30 failed; retrying.',
    'if [ "$attempt" -lt 30 ]; then',
    'AUTH_SMOKE_RESET_TOKEN=',
    "'/api/password-reset/verify'",
    '--request DELETE',
    '$BASE_URL/api/auth/me',
    'Account deletion retained a session or CSRF cookie.',
    'AUTH_SMOKE_USER_COUNT=',
    'Learning OS signup, verification, password reset, and account deletion lifecycle smoke completed.',
  ]) {
    assert.ok(script.includes(requiredContract), `Missing auth lifecycle contract: ${requiredContract}`);
  }

  const inviteCreate = script.indexOf('$invite->save();');
  const signup = script.indexOf("'/api/auth/signup'");
  const legacyAbsence = script.indexOf('prisma.user.count', signup);
  const mailToken = script.indexOf('AUTH_SMOKE_TOKEN_COUNT=', legacyAbsence);
  const verification = script.indexOf('$BASE_URL/api/verification/$verification_token', mailToken);
  const login = script.indexOf("'/api/auth/login'", verification);
  const resetRequest = script.indexOf("'/api/password-reset/request'", login);
  const queuedResetToken = script.indexOf('AUTH_SMOKE_RESET_TOKEN_COUNT=', resetRequest);
  const resetToken = script.indexOf('AUTH_SMOKE_RESET_TOKEN=', queuedResetToken);
  const reset = script.indexOf("'/api/password-reset/verify'", resetToken);
  const accountDelete = script.indexOf('--request DELETE', reset);
  const accountDeleteVerification = script.indexOf('AUTH_SMOKE_USER_COUNT=', accountDelete);
  const successCleanup = script.lastIndexOf('delete_disposable_account');

  assert.ok(inviteCreate >= 0);
  assert.ok(inviteCreate < signup);
  assert.ok(signup < legacyAbsence);
  assert.ok(legacyAbsence < mailToken);
  assert.ok(mailToken < verification);
  assert.ok(verification < login);
  assert.ok(login < resetRequest);
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

  const serverRestart = workflow.indexOf(
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"'
  );
  const authSmoke = workflow.indexOf(
    'bash .github/scripts/smoke-auth-signup-verification-lifecycle.sh',
    serverRestart
  );

  assert.ok(serverRestart >= 0);
  assert.ok(serverRestart < authSmoke);
  assert.doesNotMatch(workflow, /LEARNING_OS_SCRIPT_PROXY_ENABLED|ROUTE_PROXY_CUTOVER_STARTED/);
});
