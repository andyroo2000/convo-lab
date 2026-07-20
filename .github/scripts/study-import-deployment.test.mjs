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
    '[ "$current_config_revision" = "static-media-v1" ]',
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
    /if \[ "\$current_image" = "\$desired_learning_os_image" \] \\\n\s+&& \[ "\$running" = true \] \\\n\s+&& \[ "\$current_proxy_user_email" = "\$SMOKE_USER_EMAIL" \] \\\n\s+&& \[ "\$current_config_revision" = "static-media-v1" \]; then/
  );
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
    'LEARNING_OS_DEPLOY_CONFIG_REVISION: static-media-v1',
    'GOOGLE_APPLICATION_CREDENTIALS: /app/gcloud-key.json',
    'GCS_BUCKET_NAME: ${GCS_BUCKET_NAME}',
    'AVATARS_GCS_ROOT: ${AVATARS_GCS_ROOT:-avatars}',
    'TOOLS_AUDIO_GCS_ROOT: ${TOOLS_AUDIO_GCS_ROOT:-tools-audio}',
    '- ./server/gcloud-key.json:/app/gcloud-key.json:ro',
  ]) {
    assert.ok(compose.includes(requiredComposeContract), requiredComposeContract);
  }

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
    workflow.indexOf('csrf_cookie_jar=')
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
    'echo "PROXY_TOKEN_ID=".$accessToken->accessToken->getKey().PHP_EOL;',
    'echo "PROXY_TOKEN=".$accessToken->plainTextToken.PHP_EOL;',
    'upsert_env LEARNING_OS_API_TOKEN "$proxy_token"',
    'PROXY_TOKEN_CUTOVER_STARTED=true',
    '$COMPOSE up -d --no-deps --force-recreate "server-$active_color"',
    'wait_for_health "convolab-server-$active_color"',
    'test "$active_proxy_token" = "$proxy_token"',
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
