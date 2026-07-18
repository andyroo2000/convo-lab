import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

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

test('the production workflow wires import activation through verification and rollback', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'enable_imports:',
    'ENABLE_IMPORTS: ${{ inputs.enable_imports }}',
    'validate_boolean_input enable_imports "$ENABLE_IMPORTS"',
    '\\"studyApiImports\\" = $enable_imports_sql',
    '\\"studyApiImports\\" = $previous_imports_sql',
    'expected_flag_state="$desired_parent_sql|$enable_settings_sql|$enable_overview_sql|$enable_browser_sql|$enable_browser_detail_sql|$enable_new_queue_sql|$enable_imports_sql|',
    'bash .github/scripts/smoke-study-import-lifecycle.sh',
    'ensure_learning_os_service learning-os learning-os-api',
    'ensure_learning_os_worker',
    'current_image="$(docker inspect --format=\'{{.Config.Image}}\' "$container" 2>/dev/null || true)"',
    'if [ "$current_image" = "$desired_learning_os_image" ] && [ "$running" = true ]; then',
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

  assert.doesNotMatch(workflow, /\\"studyApiImports\\" = false/);
  assert.doesNotMatch(
    workflow,
    /\$COMPOSE up -d --no-deps --force-recreate learning-os learning-os-worker/
  );
});

test('the production workflow wires card-write activation through verification and rollback', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'enable_card_writes:',
    'ENABLE_CARD_WRITES: ${{ inputs.enable_card_writes }}',
    'validate_boolean_input enable_card_writes "$ENABLE_CARD_WRITES"',
    '\\"studyApiCardWrites\\" = $enable_card_writes_sql',
    '\\"studyApiCardWrites\\" = $previous_card_writes_sql',
    '|| [ "$ENABLE_CARD_WRITES" = true ] || [ "$ENABLE_CARD_DRAFTS" = true ]',
    'expected_flag_state="$desired_parent_sql|$enable_settings_sql|$enable_overview_sql|$enable_browser_sql|$enable_browser_detail_sql|$enable_new_queue_sql|$enable_imports_sql|$enable_settings_write_sql|$enable_new_queue_write_sql|$enable_review_sql|$enable_card_writes_sql|$enable_card_drafts_sql|$enable_media_sql"',
  ]) {
    assert.ok(workflow.includes(requiredContract), `Missing card-write contract: ${requiredContract}`);
  }

  assert.doesNotMatch(workflow, /\\"studyApiCardWrites\\" = false/);
});

test('the production workflow wires card-draft activation through disposable verification and rollback', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'enable_card_drafts:',
    'ENABLE_CARD_DRAFTS: ${{ inputs.enable_card_drafts }}',
    'validate_boolean_input enable_card_drafts "$ENABLE_CARD_DRAFTS"',
    '\\"studyApiCardDrafts\\" = $enable_card_drafts_sql',
    '\\"studyApiCardDrafts\\" = $previous_card_drafts_sql',
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

  assert.doesNotMatch(workflow, /\\"studyApiCardDrafts\\" = false/);
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
    'enable_media:',
    'ENABLE_MEDIA: ${{ inputs.enable_media }}',
    'validate_boolean_input enable_media "$ENABLE_MEDIA"',
    '\\"studyApiMedia\\" = $enable_media_sql',
    '\\"studyApiMedia\\" = $previous_media_sql',
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

  assert.doesNotMatch(workflow, /\\"studyApiMedia\\" = false/);
  const mediaSmokeBlock = workflow.slice(
    workflow.indexOf('if [ "$ENABLE_MEDIA" = true ]; then'),
    workflow.indexOf('if [ "$ENABLE_IMPORTS" = true ]; then')
  );
  assert.doesNotMatch(mediaSmokeBlock, /\^\[0-9A-HJKMNP-TV-Z\]\{26\}\$/);
  const failureCleanupBlock = workflow.slice(
    workflow.indexOf('cleanup_deployment_failure() {'),
    workflow.indexOf('trap cleanup_deployment_failure EXIT')
  );
  assert.ok(
    failureCleanupBlock.indexOf('rollback_study_flags') <
      failureCleanupBlock.indexOf('cleanup_deployment_resources')
  );
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

test('the production worker consumes Learning OS card-draft jobs', async () => {
  const compose = await readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');

  assert.match(compose, /"--queue=study-imports,study-card-drafts,default"/);
  assert.match(
    compose,
    /x-learning-os-environment:[\s\S]*OPENAI_API_KEY: \$\{OPENAI_API_KEY\}[\s\S]*STUDY_CARD_GENERATOR_MODEL: \$\{STUDY_CARD_GENERATOR_MODEL:-gpt-5\.5\}[\s\S]*STUDY_CARD_GENERATOR_REASONING_EFFORT: \$\{STUDY_CARD_GENERATOR_REASONING_EFFORT:-medium\}[\s\S]*STUDY_CARD_IMAGE_GENERATOR_MODEL: \$\{STUDY_CARD_IMAGE_GENERATOR_MODEL:-gpt-image-1\}[\s\S]*FISH_AUDIO_API_KEY: \$\{FISH_AUDIO_API_KEY\}[\s\S]*FISH_AUDIO_API_BASE_URL: \$\{FISH_AUDIO_API_BASE_URL:-https:\/\/api\.fish\.audio\}[\s\S]*FISH_AUDIO_BACKEND: \$\{FISH_AUDIO_BACKEND:-s1\}/
  );
});

test('the production workflow tolerates intentional browser drift after card-write cutover', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'Browser Learning OS independent-state smoke check passed.',
    "browser_list_path='/api/learning-os/study/browser?sortField=created_on&sortDirection=desc&limit=1'",
    "browser_list_path='/api/study/browser?sortField=created_on&sortDirection=desc&limit=1'",
    'Browser detail Learning OS independent-state smoke check passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing post-cutover browser smoke contract: ${requiredContract}`
    );
  }

  const browserBlock = workflow.slice(
    workflow.indexOf('if [ "$ENABLE_BROWSER" = true ]; then'),
    workflow.indexOf('if [ "$ENABLE_NEW_QUEUE" = true ]')
  );

  assert.match(browserBlock, /if \[ "\$ENABLE_CARD_WRITES" = true \]; then/);
  assert.match(
    browserBlock,
    /fetch_read_route[\s\S]*?\/api\/learning-os\/study\/browser\?sortField=created_on/
  );
  assert.match(browserBlock, /else[\s\S]*?compare_read_route[\s\S]*?opaque-cursor/);
  assert.match(
    browserBlock,
    /Browser detail Learning OS[\s\S]*?\/api\/learning-os\/study\/browser\/\$browser_note_id/
  );
  assert.match(
    browserBlock,
    /else[\s\S]*?compare_read_route BrowserDetail "\/api\/study\/browser\/\$browser_note_id"/
  );
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
    '$accessToken = $user->createToken("convolab-proxy", ["study:read", "study:write"]);'
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
