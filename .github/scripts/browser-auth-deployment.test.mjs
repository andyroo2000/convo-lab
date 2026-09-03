import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('the production deployment leaves Google OAuth exclusively on Learning OS', async () => {
  const [compose, workflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
  ]);
  const production = YAML.parse(compose);

  assert.equal(production['x-server-environment'], undefined);
  assert.equal(production['x-server-service'], undefined);

  for (const retiredWorkflowContract of [
    'verify_public_google_oauth() {',
    'https://convo-lab.com/api/auth/google',
    'GOOGLE_CALLBACK_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ]) {
    assert.ok(!workflow.includes(retiredWorkflowContract), retiredWorkflowContract);
  }

  const publicGate = workflow.indexOf('if ! verify_public_health \\');
  assert.ok(publicGate >= 0);
  assert.match(
    workflow.slice(publicGate),
    /if ! verify_public_health \\\s+\|\| ! verify_public_static_frontend \\\s+\|\| ! verify_public_learning_os_browser_route; then/
  );
  assert.ok(publicGate < workflow.indexOf('write_active_color "$inactive_color"'));
});

test('production configures the permanent Learning OS browser session without a bridge flag', async () => {
  const [compose, learningOsWorkflow, productionWorkflow] = await Promise.all([
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
    readFile(
      path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
      'utf8'
    ),
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-prod.yml'), 'utf8'),
  ]);

  for (const contract of [
    'SESSION_COOKIE: ${LEARNING_OS_SESSION_COOKIE:-learning_os_session}',
    'SESSION_LIFETIME: ${LEARNING_OS_SESSION_LIFETIME:-10080}',
    'SESSION_SECURE_COOKIE: ${LEARNING_OS_SESSION_SECURE_COOKIE:-true}',
    'SESSION_SAME_SITE: ${LEARNING_OS_SESSION_SAME_SITE:-lax}',
    'SANCTUM_STATEFUL_DOMAINS: ${LEARNING_OS_SANCTUM_STATEFUL_DOMAINS:-convo-lab.com,www.convo-lab.com}',
    'CORS_ALLOWED_ORIGINS: ${LEARNING_OS_CORS_ALLOWED_ORIGINS:-https://convo-lab.com,https://www.convo-lab.com}',
  ]) {
    assert.ok(compose.includes(contract), `Missing browser-session compose contract: ${contract}`);
  }
  for (const workflow of [learningOsWorkflow, productionWorkflow]) {
    assert.ok(!workflow.includes('LEARNING_OS_BROWSER_SESSION_ENABLED'));
    assert.ok(!workflow.includes('BROWSER_SESSION_ENABLED'));
  }
  assert.ok(!compose.includes('LEARNING_OS_BROWSER_SESSION_ENABLED'));
  assert.ok(
    learningOsWorkflow.includes(
      'upsert_env LEARNING_OS_SANCTUM_STATEFUL_DOMAINS "convo-lab.com,www.convo-lab.com"'
    )
  );
  assert.ok(
    learningOsWorkflow.includes('desired_deploy_config_revision="calendar-oauth-redirect-v1"')
  );
});

test('browser mutations use only the Learning OS CSRF bootstrap', async () => {
  const [clientCsrf, learningOsWorkflow, ...composes] = await Promise.all([
    readFile(path.join(repositoryRoot, 'client/src/lib/csrf.ts'), 'utf8'),
    readFile(
      path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
      'utf8'
    ),
    readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
  ]);

  assert.ok(clientCsrf.includes("const CSRF_BOOTSTRAP_PATH = '/sanctum/csrf-cookie';"));
  assert.ok(!clientCsrf.includes('/api/auth/csrf'));
  assert.ok(
    learningOsWorkflow.includes("'https://convo-lab.com/sanctum/csrf-cookie'"),
    'The production smoke should prove the public Learning OS CSRF bootstrap.'
  );
  assert.ok(!learningOsWorkflow.includes("'https://convo-lab.com/api/auth/csrf'"));
  assert.ok(!learningOsWorkflow.includes('AUTH_USER_ID'));
  assert.ok(!learningOsWorkflow.includes('AUTH_USER_ROLE'));
  for (const compose of composes) {
    assert.ok(!compose.includes('JWT_SECRET'));
    assert.ok(!compose.includes('COOKIE_SECRET'));
  }
});

test('the production workflow authenticates smoke traffic without proxy bearer credentials', async () => {
  const [workflow, compose] = await Promise.all([
    readFile(path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'), 'utf8'),
    readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8'),
  ]);

  for (const requiredContract of [
    'remove_env LEARNING_OS_API_URL',
    'remove_env LEARNING_OS_API_TOKEN',
    'remove_env LEARNING_OS_PROXY_USER_EMAIL',
    'Laravel\\Sanctum\\PersonalAccessToken::query()',
    '->where("name", "convolab-proxy")',
    'Revoked {$deleted} retired ConvoLab proxy token(s).',
    'wait_for_health "convolab-server-$active_color"',
    '"http://127.0.0.1:8080/api/convolab/browser/tools/analytics"',
    'Learning OS browser analytics internal smoke check passed.',
    'Disposable Learning OS content browser session established.',
    '--cookie "$content_browser_smoke_cookie_jar"',
    'content_browser_path \\',
    '"/api/convolab/episodes/$audio_generation_smoke_episode_id/audio/1.0"',
  ]) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing browser-session deployment contract: ${requiredContract}`
    );
  }

  for (const retiredContract of [
    'createToken("convolab-proxy"',
    'Authorization: Bearer',
    'X-Convo-Lab-User-Id',
    'proxy_token',
    'PROXY_TOKEN',
  ]) {
    assert.ok(
      !workflow.includes(retiredContract),
      `Retired proxy credential remains in production deployment: ${retiredContract}`
    );
  }
  for (const retiredComposeContract of [
    'LEARNING_OS_API_URL:',
    'LEARNING_OS_API_TOKEN:',
    'LEARNING_OS_PROXY_USER_EMAIL:',
    'CONVOLAB_PROXY_USER_EMAIL:',
  ]) {
    assert.ok(
      !compose.includes(retiredComposeContract),
      `Retired proxy credential remains in production Compose: ${retiredComposeContract}`
    );
  }
});
