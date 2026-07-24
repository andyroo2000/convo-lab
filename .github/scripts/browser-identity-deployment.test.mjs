import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const execFileAsync = promisify(execFile);
const directGoogleCallback =
  'https://convo-lab.com/api/convolab/browser/auth/google/callback';
const encodedDirectGoogleCallback =
  'https%3A%2F%2Fconvo-lab.com%2Fapi%2Fconvolab%2Fbrowser%2Fauth%2Fgoogle%2Fcallback';

async function readRepositoryFile(file) {
  return readFile(path.join(repositoryRoot, file), 'utf8');
}

test('Learning OS production receives versioned Google OAuth configuration', async () => {
  const [composeSource, workflowSource] = await Promise.all([
    readRepositoryFile('docker-compose.prod.yml'),
    readRepositoryFile('.github/workflows/deploy-learning-os-prod.yml'),
  ]);
  const compose = YAML.parse(composeSource);
  const workflow = YAML.parse(workflowSource);
  const learningEnvironment = compose['x-learning-os-environment'];
  const deployJob = workflow.jobs.deploy;
  const validateStep = deployJob.steps.find((step) => step.name === 'Validate inputs');
  const deployStep = deployJob.steps.find((step) => step.name === 'Deploy Learning OS');

  assert.equal(learningEnvironment.GOOGLE_CLIENT_ID, '${GOOGLE_CLIENT_ID}');
  assert.equal(learningEnvironment.GOOGLE_CLIENT_SECRET, '${GOOGLE_CLIENT_SECRET}');
  assert.equal(
    learningEnvironment.GOOGLE_REDIRECT_URI,
    '${LEARNING_OS_GOOGLE_REDIRECT_URI}'
  );
  assert.equal(
    learningEnvironment.LEARNING_OS_GOOGLE_OAUTH_CONFIG_REVISION,
    '${LEARNING_OS_GOOGLE_OAUTH_CONFIG_REVISION}'
  );

  for (const step of [validateStep, deployStep]) {
    assert.equal(step.env.DEPLOY_GOOGLE_CLIENT_ID, '${{ secrets.GOOGLE_CLIENT_ID }}');
    assert.equal(step.env.DEPLOY_GOOGLE_CLIENT_SECRET, '${{ secrets.GOOGLE_CLIENT_SECRET }}');
  }

  for (const contract of [
    'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets must be set',
    'GOOGLE_CLIENT_ID must not use the placeholder sentinel',
  ]) {
    assert.ok(validateStep.run.includes(contract), `Missing OAuth validation: ${contract}`);
  }

  for (const contract of [
    'DEPLOY_GOOGLE_CLIENT_ID=%q',
    'DEPLOY_GOOGLE_CLIENT_SECRET=%q',
    `google_redirect_uri="${directGoogleCallback}"`,
    'upsert_env GOOGLE_CLIENT_ID "$DEPLOY_GOOGLE_CLIENT_ID"',
    'upsert_env GOOGLE_CLIENT_SECRET "$DEPLOY_GOOGLE_CLIENT_SECRET"',
    'upsert_env LEARNING_OS_GOOGLE_REDIRECT_URI "$google_redirect_uri"',
    'google_oauth_config_revision="$(printf',
    'upsert_env LEARNING_OS_GOOGLE_OAUTH_CONFIG_REVISION "$google_oauth_config_revision"',
    "sed -n 's/^LEARNING_OS_GOOGLE_OAUTH_CONFIG_REVISION=//p'",
    '[ "$current_google_oauth_config_revision" = "$google_oauth_config_revision" ]',
  ]) {
    assert.ok(deployStep.run.includes(contract), `Missing Learning OS OAuth contract: ${contract}`);
  }
});

test('Learning OS deploy validates configuration and the real OAuth redirect', async () => {
  const workflowSource = await readRepositoryFile(
    '.github/workflows/deploy-learning-os-prod.yml'
  );

  for (const contract of [
    '-e EXPECTED_GOOGLE_REDIRECT_URI="$google_redirect_uri"',
    'config("services.google.client_id")',
    'config("services.google.client_secret")',
    'config("services.google.redirect") !== getenv("EXPECTED_GOOGLE_REDIRECT_URI")',
    '"follow_location" => 0',
    '"http://127.0.0.1:8080/api/convolab/browser/auth/google"',
    'parse_url($location, PHP_URL_HOST) !== "accounts.google.com"',
    '($query["client_id"] ?? null) === "placeholder"',
    '($query["redirect_uri"] ?? null) !== getenv("EXPECTED_GOOGLE_REDIRECT_URI")',
    'trim((string) ($query["state"] ?? "")) === ""',
    'Learning OS Google OAuth redirect smoke failed.',
  ]) {
    assert.ok(workflowSource.includes(contract), `Missing internal OAuth smoke: ${contract}`);
  }

  const healthGate = workflowSource.indexOf('wait_for_health learning-os-api');
  const redirectProbe = workflowSource.indexOf(
    '"http://127.0.0.1:8080/api/convolab/browser/auth/google"'
  );
  assert.ok(healthGate >= 0);
  assert.ok(redirectProbe > healthGate);
});

test('Convo Lab permanently routes browser identity through Learning OS', async () => {
  const [workflowSource, routerSource] = await Promise.all([
    readRepositoryFile('.github/workflows/deploy-prod.yml'),
    readRepositoryFile('deploy/prod-router.conf.template'),
  ]);

  for (const contract of [
    `upsert_env LEARNING_OS_GOOGLE_REDIRECT_URI \\\n              ${directGoogleCallback}`,
    'https://convo-lab.com/api/convolab/browser/auth/google)',
    '.github/scripts/validate-google-oauth-redirect.sh',
    encodedDirectGoogleCallback,
    'Direct Google OAuth redirect failed: $oauth_failure',
    'https://convo-lab.com/api/convolab/browser/auth/verification)',
    'Direct verification route probe returned HTTP $verification_status instead of 422.',
    'https://convo-lab.com/api/convolab/browser/auth/google/invite)',
    'Direct invite claim route probe returned HTTP $invite_claim_status instead of 401.',
  ]) {
    assert.ok(workflowSource.includes(contract), `Missing public identity smoke: ${contract}`);
  }

  const browserSmoke = workflowSource.indexOf(
    'verify_public_learning_os_browser_route() ('
  );
  const googleProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/google)',
    browserSmoke
  );
  const verificationProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/verification)',
    browserSmoke
  );
  const inviteProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/google/invite)',
    browserSmoke
  );
  assert.ok(browserSmoke >= 0);
  assert.ok(googleProbe > browserSmoke);
  assert.ok(verificationProbe > googleProbe);
  assert.ok(inviteProbe > verificationProbe);

  const browserAuthBlock = routerSource.slice(
    routerSource.indexOf('location ~ ^/api/convolab/browser/auth(?:/|$)'),
    routerSource.indexOf('location ~ ^/api/auth/password(?:/|$)')
  );
  assert.ok(browserAuthBlock.includes('proxy_pass $learning_os_upstream;'));
  assert.ok(browserAuthBlock.includes('proxy_set_header Authorization "";'));
  assert.ok(browserAuthBlock.includes('proxy_set_header X-Convo-Lab-User-Id "";'));
  assert.ok(!browserAuthBlock.includes('return 404;'));
  assert.ok(!workflowSource.includes('LEARNING_OS_DIRECT_AUTH_API_ENABLED'));
});

test('local Vite development mirrors the permanent Learning OS browser routes', async () => {
  const viteConfig = await readRepositoryFile('client/vite.config.ts');
  const learningOsRoutes = [
    "'/sanctum/csrf-cookie'",
    "'/api/convolab/auth'",
    "'/api/convolab/browser/auth'",
    "'/api/auth/password'",
    "'/api/convolab/episodes'",
    "'/api/convolab/courses'",
    "'/api/convolab/scripts'",
    "'/api/convolab/admin'",
  ];
  const expressFallback = viteConfig.indexOf("'/api':");

  assert.ok(expressFallback >= 0);
  for (const route of learningOsRoutes) {
    const routeStart = viteConfig.indexOf(`${route}:`);
    const routeEnd = viteConfig.indexOf('},', routeStart);
    const proxyBlock = viteConfig.slice(routeStart, routeEnd);

    assert.ok(routeStart >= 0, `Missing local Learning OS proxy route: ${route}`);
    assert.ok(routeStart < expressFallback, `${route} must precede the generic Express proxy`);
    assert.ok(proxyBlock.includes("target: 'http://localhost:8080'"));
    assert.ok(proxyBlock.includes('changeOrigin: true'));
  }

  const expressProxy = viteConfig.slice(expressFallback, viteConfig.indexOf('},', expressFallback));
  assert.ok(expressProxy.includes("target: 'http://localhost:3001'"));
});

test('Google OAuth redirect validation executes the production Bash parser', async () => {
  const validator = path.join(
    repositoryRoot,
    '.github/scripts/validate-google-oauth-redirect.sh'
  );
  const validLocation =
    `https://accounts.google.com/o/oauth2/auth?scope=openid&client_id=client-123` +
    `&redirect_uri=${encodedDirectGoogleCallback}&state=state-123`;

  await execFileAsync('bash', [validator, validLocation, encodedDirectGoogleCallback, 'true']);

  for (const invalidLocation of [
    validLocation.replace('client-123', 'placeholder'),
    validLocation.replace(encodedDirectGoogleCallback, 'https%3A%2F%2Fexample.com%2Fcallback'),
    validLocation.replace('&state=state-123', ''),
  ]) {
    await assert.rejects(
      execFileAsync('bash', [
        validator,
        invalidLocation,
        encodedDirectGoogleCallback,
        'true',
      ])
    );
  }
});
