import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const directGoogleCallback =
  'https://convo-lab.com/api/convolab/browser/auth/google/callback';

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

test('Convo Lab rollout gates direct browser identity through the public router', async () => {
  const workflowSource = await readRepositoryFile('.github/workflows/deploy-prod.yml');

  for (const contract of [
    `upsert_env LEARNING_OS_GOOGLE_REDIRECT_URI \\\n              ${directGoogleCallback}`,
    'https://convo-lab.com/api/convolab/browser/auth/google)',
    'Direct Google OAuth route did not redirect to Google.',
    'Direct Google OAuth redirect did not use the Learning OS callback.',
    'Direct Google OAuth redirect has an invalid client ID.',
    'Direct Google OAuth redirect did not include state.',
    'https://convo-lab.com/api/convolab/browser/auth/verification)',
    'Direct verification route probe returned HTTP $verification_status instead of 422.',
    'https://convo-lab.com/api/convolab/browser/auth/google/invite)',
    'Direct invite claim route probe returned HTTP $invite_claim_status instead of 401.',
  ]) {
    assert.ok(workflowSource.includes(contract), `Missing public identity smoke: ${contract}`);
  }

  const directAuthGate = workflowSource.indexOf(
    'if [ "$direct_auth_api_enabled" = true ]; then'
  );
  const googleProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/google)',
    directAuthGate
  );
  const verificationProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/verification)',
    directAuthGate
  );
  const inviteProbe = workflowSource.indexOf(
    'https://convo-lab.com/api/convolab/browser/auth/google/invite)',
    directAuthGate
  );
  assert.ok(directAuthGate >= 0);
  assert.ok(googleProbe > directAuthGate);
  assert.ok(verificationProbe > googleProbe);
  assert.ok(inviteProbe > verificationProbe);
});
