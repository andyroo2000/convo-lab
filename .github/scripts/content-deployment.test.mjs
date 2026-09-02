import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

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
    "'/api/convolab/episodes?library=true&limit=1&offset=0'",
    "'Episode detail Learning OS'",
    'Episode Learning OS read smoke checks passed.',
    "'Course list Learning OS'",
    "'/api/convolab/courses?library=true&limit=1&offset=0'",
    "'Course detail Learning OS'",
    'Course Learning OS read smoke checks passed.',
  ]) {
    assert.ok(workflow.includes(requiredContract), requiredContract);
  }
  assert.doesNotMatch(
    workflow,
    /\/api\/(?:episodes|courses)\b/u,
    'The production rehearsal must not call retired Express content routes'
  );

  const migration = workflow.indexOf('php artisan migrate --force');
  const episodeImport = workflow.indexOf('php artisan content:import-convolab-episodes');
  const serverHealthy = workflow.indexOf('wait_for_health "convolab-server-$active_color"');
  const episodeSmoke = workflow.indexOf('Episode Learning OS read smoke checks passed.');
  const courseSmoke = workflow.indexOf('Course Learning OS read smoke checks passed.');

  assert.ok(migration >= 0);
  assert.ok(migration < episodeImport);
  assert.ok(episodeImport < serverHealthy);
  assert.ok(serverHealthy < episodeSmoke);
  assert.ok(episodeSmoke < courseSmoke);
});

test('direct Learning OS content smoke uses a disposable admin browser session', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'concurrency:\n  group: production-deploy\n  cancel-in-progress: false',
    'content_browser_smoke_convolab_id=',
    '"deployment-content-browser-%@example.invalid"',
    'whereHas(',
    '$user = Illuminate\\Support\\Facades\\DB::transaction(function () {',
    '"role" => "admin"',
    "'https://convo-lab.com/sanctum/csrf-cookie'",
    "'https://convo-lab.com/api/convolab/browser/auth/login'",
    'fetch_content_browser_route() {',
    'mutate_content_browser_route() {',
    '--cookie "$content_browser_smoke_cookie_jar"',
    '--header "X-XSRF-TOKEN: $content_browser_smoke_csrf_token"',
    'echo "::add-mask::$content_browser_smoke_csrf_raw"',
    'echo "::add-mask::$content_browser_smoke_csrf_token"',
    'echo "::add-mask::$content_browser_smoke_session"',
    "printf '%s&viewAs=%s'",
    "printf '%s?viewAs=%s'",
    'cleanup_content_browser_smoke best-effort',
    'cleanup_content_browser_smoke',
    'DB::table("admin_user_projections")\n                      ->where(\n                        "convolab_id",\n                        getenv("CONTENT_BROWSER_SMOKE_CONVOLAB_ID"),',
    '"Disposable Learning OS content browser identity still exists."',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing content browser-session contract: ${requiredContract}`
    );
  }

  const setup = workflow.indexOf('Disposable Learning OS content browser session established.');
  const login = workflow.indexOf(
    "'https://convo-lab.com/api/convolab/browser/auth/login'"
  );
  const refreshedCsrf = workflow.indexOf('content_browser_smoke_csrf_raw="$(awk', login);
  const firstRead = workflow.indexOf('episode_list="$(fetch_content_browser_route');
  const finalContentCheck = workflow.indexOf(
    'Audio Script Learning OS routing and streaming smoke checks passed.'
  );
  const cleanup = workflow.indexOf('cleanup_content_browser_smoke', finalContentCheck);

  assert.ok(setup >= 0);
  assert.ok(login >= 0);
  assert.ok(login < refreshedCsrf);
  assert.ok(refreshedCsrf < setup);
  assert.ok(setup < firstRead);
  assert.ok(firstRead < finalContentCheck);
  assert.ok(finalContentCheck < cleanup);

  assert.doesNotMatch(workflow, /\bfetch_read_route\s*\(\)/);
  assert.doesNotMatch(workflow, /\bmutate_proxy_route\s*\(\)/);
});

test('the production workflow proves public course CRUD and removes every smoke artifact', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'course_write_smoke_marker="$(cat /proc/sys/kernel/random/uuid)"',
    "course_create=\"$(mutate_content_browser_route POST '/api/convolab/courses'",
    'course_write_smoke_id=',
    'Course create returned an invalid id.',
    'Course create returned an unexpected title.',
    'Course create returned an unexpected status.',
    'Course create returned an unexpected description.',
    'Course create returned an unexpected maxLessonDurationMinutes.',
    '"/api/convolab/courses/$course_write_smoke_id"',
    'response?.message !== "Course updated successfully"',
    'Course update returned an unexpected message.',
    "'Updated course Learning OS'",
    'course.description !== null',
    'course.maxLessonDurationMinutes !== 45',
    'Updated course returned an unexpected id.',
    'Updated course returned an unexpected title.',
    'Updated course returned an unexpected description.',
    'Updated course returned an unexpected maxLessonDurationMinutes.',
    'response?.message !== "Course deleted successfully"',
    'Course delete returned an unexpected message.',
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
  const create = workflow.indexOf(
    "course_create=\"$(mutate_content_browser_route POST '/api/convolab/courses'"
  );
  const update = workflow.indexOf('course_update="$(mutate_content_browser_route');
  const detail = workflow.indexOf("'Updated course Learning OS'");
  const deleteCourse = workflow.indexOf('course_delete="$(mutate_content_browser_route');
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
    "episode_create=\"$(mutate_content_browser_route POST '/api/convolab/episodes'",
    'episode_write_smoke_id=',
    '"/api/convolab/episodes/$episode_write_smoke_id"',
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
  const create = workflow.indexOf(
    "episode_create=\"$(mutate_content_browser_route POST '/api/convolab/episodes'"
  );
  const update = workflow.indexOf('episode_update="$(mutate_content_browser_route');
  const detail = workflow.indexOf("'Updated episode Learning OS'");
  const deleteEpisode = workflow.indexOf('episode_delete="$(mutate_content_browser_route');
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

test('the production stack wires and smokes direct Learning OS static media', async () => {
  const [compose, workflow, productionWorkflow, router, viteConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(
      path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
      'utf8'
    ),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'deploy/prod-router.conf.template'), 'utf8'),
    readFile(path.join(repositoryRoot, 'client/vite.config.ts'), 'utf8'),
  ]);

  for (const requiredComposeContract of [
    'LEARNING_OS_DEPLOY_CONFIG_REVISION: ${LEARNING_OS_DEPLOY_CONFIG_REVISION}',
    'GOOGLE_APPLICATION_CREDENTIALS: /app/gcloud-key.json',
    'GCS_BUCKET_NAME: ${GCS_BUCKET_NAME}',
    'AVATARS_GCS_ROOT: ${AVATARS_GCS_ROOT:-avatars}',
    'AVATAR_SIGNED_URLS_ENABLED: ${AVATAR_SIGNED_URLS_ENABLED:-true}',
    'TOOLS_AUDIO_GCS_ROOT: ${TOOLS_AUDIO_GCS_ROOT:-tools-audio}',
    'TOOLS_AUDIO_SIGNED_URLS_ENABLED: ${TOOLS_AUDIO_SIGNED_URLS_ENABLED:-true}',
    '- /opt/convolab-runtime/secrets/gcloud-key.json:/app/gcloud-key.json:ro',
  ]) {
    assert.ok(compose.includes(requiredComposeContract), requiredComposeContract);
  }

  assert.doesNotMatch(compose, /x-server-environment|x-server-service/);
  assert.doesNotMatch(compose, /LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED/);
  assert.ok(router.includes('location ~ ^/api/avatars(?:/|$)'));
  assert.ok(router.includes('location ~ ^/api/tools-audio(?:/|$)'));
  assert.ok(viteConfig.includes("'/api/avatars'"));
  assert.ok(viteConfig.includes("'/api/tools-audio'"));
  assert.ok(viteConfig.indexOf("'/api/avatars'") < viteConfig.indexOf("'/api':"));
  assert.ok(viteConfig.indexOf("'/api/tools-audio'") < viteConfig.indexOf("'/api':"));

  for (const requiredSmokeContract of [
    "'https://convo-lab.com/api/avatars/voices/ja-shohei.jpg'",
    'Avatar direct Learning OS smoke check passed.',
    "'/api/tools-audio/signed-urls'",
    'mutate_learning_os_route',
    'Tool Audio direct Learning OS smoke check passed.',
  ]) {
    assert.ok(workflow.includes(requiredSmokeContract), requiredSmokeContract);
  }
  for (const requiredProductionContract of [
    'https://convo-lab.com/api/avatars/voices/ja-shohei.jpg',
    'Direct Learning OS avatar probe returned HTTP',
    'Direct Learning OS avatar probe did not reach PHP.',
    'https://convo-lab.com/api/tools-audio/signed-urls',
    'Direct Learning OS tool-audio probe returned HTTP',
    'Direct Learning OS tool-audio probe did not return signed URLs.',
  ]) {
    assert.ok(
      productionWorkflow.includes(requiredProductionContract),
      requiredProductionContract
    );
  }
});

test('active Study traffic uses Learning OS directly without an Express rollback path', async () => {
  const [viteConfig, studyHook, dailyAudioHook, knownKanjiHook, csrf, router] =
    await Promise.all([
      readFile(path.join(repositoryRoot, 'client/vite.config.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'client/src/hooks/useStudy.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'client/src/hooks/useDailyAudioPractice.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'client/src/hooks/useKnownKanji.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'client/src/lib/csrf.ts'), 'utf8'),
      readFile(path.join(repositoryRoot, 'deploy/prod-router.conf.template'), 'utf8'),
    ]);

  assert.ok(viteConfig.includes("'^/api/study(?:/|$)'"));
  assert.ok(viteConfig.includes("'^/api/daily-audio-practice(?:/|$)'"));
  assert.ok(!viteConfig.includes("'^/api/learning-os/study(?:/|$)'"));
  assert.ok(viteConfig.indexOf("'^/api/study(?:/|$)'") < viteConfig.indexOf("'/api':"));
  assert.ok(studyHook.includes('studyApiPath(endpoint)'));
  assert.ok(dailyAudioHook.includes('DAILY_AUDIO_API_BASE'));
  assert.ok(knownKanjiHook.includes("studyApiPath('/known-kanji')"));
  assert.ok(knownKanjiHook.includes("studyApiPath('/wanikani')"));
  assert.ok(csrf.includes("const CSRF_BOOTSTRAP_PATH = '/sanctum/csrf-cookie';"));
  assert.ok(csrf.includes("url.pathname.startsWith('/api/')"));
  assert.ok(!csrf.includes('LEARNING_OS_CSRF_NAMESPACES'));
  assert.ok(!csrf.includes('/api/learning-os/study'));
  assert.ok(router.includes('location ~ ^/api/study(?:/|$)'));
  assert.ok(router.includes('location ~ ^/api/daily-audio-practice(?:/|$)'));
  assert.ok(!router.includes('location ~ ^/api/learning-os/study(?:/|$)'));
  assert.ok(router.includes('proxy_pass $frontend_upstream;'));
  assert.ok(!router.includes('location ^~ /api/study'));
  assert.ok(!router.includes('location ^~ /api/learning-os/study'));
  assert.ok(!router.includes('/api/learning-os/study/imports/'));

  for (const route of ['/api/study', '/api/daily-audio-practice']) {
    const start = router.indexOf(`location ~ ^${route}(?:/|$)`);
    const end = router.indexOf('\n    location ', start + 1);
    const block = router.slice(start, end);
    assert.ok(start >= 0);
    assert.ok(block.includes('proxy_set_header Authorization $http_authorization;'));
    assert.ok(!block.includes('proxy_set_header Authorization "";'));
    assert.ok(block.includes('proxy_set_header X-Convo-Lab-User-Id "";'));
  }
});

test('the production workflow verifies and cleans up a disposable card draft', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    "mutate_learning_os_route POST '/api/study/card-drafts'",
    "'/api/study/card-drafts?limit=200'",
    '"/api/study/card-drafts/$draft_id"',
    'card_draft_smoke_id="$draft_id"',
    '"/api/study/card-drafts/$card_draft_smoke_id"',
    'card_draft_smoke_id=',
    'Study card draft lifecycle smoke check passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing card-draft contract: ${requiredContract}`
    );
  }

  assert.ok(
    workflow.indexOf('mutate_learning_os_route DELETE') <
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
    '"https://convo-lab.com/api/study/media/$media_smoke_id"',
    "--header 'Origin: https://convo-lab.com'",
    '--cookie "$content_browser_smoke_cookie_jar"',
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
    '"https://convo-lab.com/api/study/media/$media_smoke_id"'
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

test('the production workflow verifies migrated Daily Audio through Learning OS', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    "'/api/daily-audio-practice'",
    'Daily Audio historical track lookup',
    'daily_audio_smoke_practice_id=',
    'DAILY_AUDIO_SMOKE_PRACTICE_ID="$daily_audio_smoke_practice_id"',
    'DailyAudioPracticeGeneration::storagePath(',
    'DailyAudioPracticeGeneration::audioUrl(',
    '"learning-os-daily-audio-smoke"',
    'Disposable Daily Audio fixture created.',
    'Disposable Daily Audio fixture appeared in the browser list.',
    'Disposable Daily Audio fixture detail loaded.',
    'Disposable Daily Audio track URL validated.',
    'Disposable Daily Audio track downloaded.',
    'Daily Audio stream returned unexpected bytes.',
    'Daily Audio stream is missing expected header:',
    "'^(HTTP/|content-(type|length|disposition|security-policy):|cross-origin-resource-policy:|x-content-type-options:)'",
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
    'cleanup_daily_audio_fixture',
    '"Disposable Daily Audio fixture still exists."',
    'Historical Daily Audio streaming smoke check passed.',
    'Disposable Daily Audio fixture cleanup passed.',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing Daily Audio cutover contract: ${requiredContract}`
    );
  }

  const dailyAudioBlock = workflow.slice(
    workflow.indexOf('daily_audio_smoke_practice_id="$(docker exec'),
    workflow.indexOf("'Browser Learning OS'")
  );
  assert.doesNotMatch(dailyAudioBlock, /if \[ -z "\$daily_audio_id" \]; then/);
  assert.doesNotMatch(
    dailyAudioBlock,
    /daily_audio_smoke_output=/,
    'Tinker failures must remain visible instead of being captured in command substitution'
  );
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
    dailyAudioBlock.indexOf(
      'test "$(cat "$daily_audio_smoke_body")" = "learning-os-daily-audio-smoke"'
    ) <
      dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.')
  );
  assert.ok(
    dailyAudioBlock.indexOf('Historical Daily Audio streaming smoke check passed.') <
      dailyAudioBlock.indexOf('cleanup_daily_audio_fixture')
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

test('the lifecycle smoke script remains valid Bash', async () => {
  const scriptPath = path.join(
    repositoryRoot,
    '.github/scripts/smoke-study-import-lifecycle.sh'
  );
  const [script, workflow] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
  ]);

  await execFileAsync('bash', ['-n', scriptPath]);

  for (const requiredContract of [
    'trap cleanup EXIT',
    'RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"',
    'docker logs --since "$RUN_STARTED_AT" --tail=300 learning-os-worker',
    ': "${STUDY_SMOKE_USER_ID:?STUDY_SMOKE_USER_ID is required}"',
    ': "${STUDY_SMOKE_COOKIE_JAR:?STUDY_SMOKE_COOKIE_JAR is required}"',
    ': "${STUDY_SMOKE_CSRF_TOKEN:?STUDY_SMOKE_CSRF_TOKEN is required}"',
    ': "${JSON_TOOLS_CONTAINER:?JSON_TOOLS_CONTAINER is required}"',
    'delete_learning_os_smoke_import_files',
    'docker exec -e IMPORT_SMOKE_USER_ID="$STUDY_SMOKE_USER_ID" learning-os-api',
    "--header 'Origin: https://convo-lab.com'",
    '--header "X-XSRF-TOKEN: $STUDY_SMOKE_CSRF_TOKEN"',
    '--cookie "$STUDY_SMOKE_COOKIE_JAR"',
    '--cookie-jar "$STUDY_SMOKE_COOKIE_JAR"',
    '/api/study/imports/readiness',
    "/api/study/imports'",
    '/api/study/imports/$import_job_id/upload',
    'response.data.import_job.id',
    'response.data.status',
    'response.data.preview.note_count',
    'archive_sha256="$(sha256sum "$ARCHIVE_PATH"',
    'IMPORT_SMOKE_SHA256=',
    'Uploaded import archive checksum mismatch:',
    '/api/study/imports/$import_job_id/complete',
    '/api/study/imports/$import_job_id',
    '/api/study/imports/$cancel_job_id/cancel',
    'response.data.error_message === "Study import upload was cancelled."',
    'response.data.summary.imported_cards',
  ]) {
    assert.ok(script.includes(requiredContract), `Missing lifecycle contract: ${requiredContract}`);
  }

  for (const retiredContract of [
    '/api/learning-os/study',
    'delete_convolab_smoke_user',
    'restore_proxy_identity',
    'wait_for_public_csrf',
    'csrf_cookie_raw',
    'auth_token',
    'LEARNING_OS_PROXY_USER_EMAIL',
    '$COMPOSE up -d',
    'Authorization: Bearer',
    'proxy_token',
    'IMPORT_SMOKE_EMAIL',
    'createToken(',
    '$user->delete()',
  ]) {
    assert.ok(!script.includes(retiredContract), `Retired import smoke bridge remains: ${retiredContract}`);
  }

  assert.doesNotMatch(script, /ACTIVE_COLOR|SERVER_CONTAINER|convolab-server-/);
  assert.match(script, /"\$JSON_TOOLS_CONTAINER" \\\n    node --input-type=module/);

  const toolsHealthy = workflow.indexOf('wait_for_health "$DEPLOYMENT_TOOLS_CONTAINER"');
  const importSmoke = workflow.indexOf('bash .github/scripts/smoke-study-import-lifecycle.sh');

  assert.ok(toolsHealthy >= 0);
  assert.ok(toolsHealthy < importSmoke);
  assert.match(
    workflow.slice(toolsHealthy, importSmoke),
    /JSON_TOOLS_CONTAINER="\$DEPLOYMENT_TOOLS_CONTAINER"/
  );
});
