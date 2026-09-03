import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

import { assertRequiredGenerationProxyContracts } from './study-import-generation-contracts.mjs';
import {
  assertAlwaysOnStudyApiContracts,
  assertPermanentBrowserApiContracts,
} from './study-import-routing-contracts.mjs';

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
  assertAlwaysOnStudyApiContracts(workflow);
});

test('production permanently routes migrated browser APIs', async () => {
  const [compose, workflow, router, viteConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'deploy/prod-router.conf.template'), 'utf8'),
    readFile(path.join(repositoryRoot, 'client/vite.config.ts'), 'utf8'),
  ]);
  assertPermanentBrowserApiContracts({ compose, workflow, router, viteConfig });
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

  assertRequiredGenerationProxyContracts(workflow);

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
