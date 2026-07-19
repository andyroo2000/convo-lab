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
    'expected_flag_state="$desired_parent_sql|$enable_settings_sql|$enable_overview_sql|$enable_browser_sql|$enable_browser_detail_sql|$enable_new_queue_sql|$enable_imports_sql|$enable_settings_write_sql|$enable_new_queue_write_sql|$enable_review_sql|$enable_card_writes_sql|$enable_card_drafts_sql|$enable_media_sql|$enable_daily_audio_sql"',
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

test('the production workflow snapshots and imports historical GCS media explicitly', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'import_historical_media:',
    'IMPORT_HISTORICAL_MEDIA: ${{ inputs.import_historical_media }}',
    'validate_boolean_input import_historical_media "$IMPORT_HISTORICAL_MEDIA"',
    'restore_convolab_source_copy',
    'SOURCE_DATABASE_CREATED=true',
    'cleanup_media_export',
    'cleanup_media_import_resources',
    'MEDIA_MISSING_MANIFEST_CONTAINER="/tmp/convolab-learning-os-missing-media.json"',
    'learning-os-before-media-import-$timestamp.dump',
    'Skipping $unavailable_media_count unavailable ConvoLab media rows without storage paths.',
    'gcs_bucket="$($COMPOSE run --rm -T --no-deps',
    'sh -c \'printf "%s" "$GCS_BUCKET_NAME"\'',
    'expected_audio_prefix="https://storage.googleapis.com/$gcs_bucket/"',
    'json_agg(paths.storage_path ORDER BY paths.storage_path)',
    'WHERE \\"storagePath\\" IS NOT NULL',
    'AND length(btrim(\\"storagePath\\")) > 0',
    'FROM daily_audio_practice_tracks',
    "WHERE status = 'ready'",
    'AND \\"audioUrl\\" IS NOT NULL',
    '"server-$active_color"',
    'node scripts/export-convolab-study-media.mjs',
    '--missing-manifest /export/missing.json',
    'convolab-postgres chmod 644',
    'pg_read_file(\'$MEDIA_MISSING_MANIFEST_CONTAINER\')::jsonb',
    "WHERE storage_path LIKE 'daily-audio-practice/%'",
    'Missing $missing_daily_audio_count historical Daily Audio GCS objects.',
    'SET \\"storagePath\\" = NULL',
    'Skipping $missing_media_count ConvoLab media rows whose GCS objects are missing.',
    '--volume "$MEDIA_EXPORT_DIR:/export"',
    '--volume "$media_files:/tmp/convolab-media:ro"',
    'php artisan migration:import-convolab-media',
    '--production-confirmation="IMPORT MEDIA INTO $TARGET_DB"',
    'php artisan migration:import-convolab-daily-audio',
    '--source-bucket="$gcs_bucket"',
    '--production-confirmation="IMPORT DAILY AUDIO INTO $TARGET_DB"',
    'Verified ConvoLab historical study and Daily Audio media import completed.',
    'smoke_learning_os',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing historical media import contract: ${requiredContract}`
    );
  }

  const mediaOnlyBranch = workflow.slice(
    workflow.indexOf('else\n              $COMPOSE run --rm -T --no-deps learning-os php artisan migrate'),
    workflow.indexOf('proxy_token_output=')
  );
  const databaseBranchIndex = workflow.indexOf('if [ "$REBUILD_DATABASE" = true ]; then');
  const sharedPostgresUserIndex = workflow.indexOf(
    'postgres_user="$(sed -n \'s/^POSTGRES_USER=//p\' .env.production | tail -1)"\n' +
      '            test -n "$postgres_user"'
  );
  assert.ok(sharedPostgresUserIndex >= 0);
  assert.ok(sharedPostgresUserIndex < databaseBranchIndex);
  assert.ok(
    mediaOnlyBranch.indexOf('restore_convolab_source_copy') <
      mediaOnlyBranch.indexOf('import_historical_media')
  );
  assert.match(
    mediaOnlyBranch,
    /dropdb --username="\$postgres_user" "\$SOURCE_DB"[\s\S]*smoke_learning_os/
  );
  assert.doesNotMatch(
    mediaOnlyBranch,
    /dropdb --username="\$postgres_user" --if-exists "\$TARGET_DB"/
  );
  assert.ok(
    workflow.indexOf('cleanup_media_import_resources') <
      workflow.indexOf('if [ -n "$NEW_PROXY_TOKEN_ID" ]')
  );

  const rebuildBranch = workflow.slice(
    workflow.indexOf('if [ "$REBUILD_DATABASE" = true ]; then'),
    workflow.indexOf('else\n              $COMPOSE run --rm -T --no-deps learning-os php artisan migrate')
  );
  assert.ok(
    rebuildBranch.indexOf('import_historical_media') <
      rebuildBranch.indexOf('smoke_learning_os')
  );

  const mediaImportFunction = workflow.slice(
    workflow.indexOf('import_historical_media() {'),
    workflow.indexOf('smoke_learning_os() {')
  );
  assert.match(mediaImportFunction, /case "\$active_color" in[\s\S]*blue\|green/);
  assert.match(mediaImportFunction, /"server-\$active_color"/);
  assert.ok(
    mediaImportFunction.indexOf('if ! [[ "$gcs_bucket" =~') <
      mediaImportFunction.indexOf('expected_audio_prefix=')
  );
  assert.doesNotMatch(mediaImportFunction, /:'gcs_bucket'/);
  assert.doesNotMatch(mediaImportFunction, /\bserver-blue\b/);
  assert.doesNotMatch(
    mediaImportFunction,
    /unavailable_media_count[\s\S]*media rows without storage paths\." >&2[\s\S]*return 1/
  );
  assert.ok(
    mediaImportFunction.indexOf('missing_daily_audio_count=') <
      mediaImportFunction.indexOf('UPDATE study_media')
  );
  assert.ok(
    mediaImportFunction.indexOf('migration:import-convolab-media') <
      mediaImportFunction.indexOf('migration:import-convolab-daily-audio')
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

test('the production workflow migrates and streams Daily Audio before accepting cutover', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'enable_daily_audio:',
    'ENABLE_DAILY_AUDIO: ${{ inputs.enable_daily_audio }}',
    'validate_boolean_input enable_daily_audio "$ENABLE_DAILY_AUDIO"',
    '\\"studyApiDailyAudio\\" = $enable_daily_audio_sql',
    '\\"studyApiDailyAudio\\" = $previous_daily_audio_sql',
    'strict|opaque-cursor|overview-state|new-queue-state|daily-audio-media',
    'DailyAudioList',
    'DailyAudioDetail',
    'daily-audio-media',
    'Daily Audio historical track lookup',
    'No historical ready Daily Audio practice is available for streaming verification.',
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
    workflow.indexOf('if [ "$ENABLE_DAILY_AUDIO" = true ]; then'),
    workflow.indexOf('if [ "$ENABLE_BROWSER" = true ]; then')
  );
  assert.ok(
    dailyAudioBlock.indexOf('if [ -z "$daily_audio_id" ]; then') <
      dailyAudioBlock.indexOf('DailyAudioDetail')
  );
  assert.doesNotMatch(dailyAudioBlock, /if \[ -n "\$daily_audio_id" \]; then/);
  assert.ok(
    dailyAudioBlock.indexOf('DailyAudioDetail') <
      dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.')
  );
  assert.ok(
    dailyAudioBlock.indexOf('test -s "$daily_audio_smoke_body"') <
      dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.')
  );
  assert.doesNotMatch(workflow, /\\"studyApiDailyAudio\\" = false/);
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
