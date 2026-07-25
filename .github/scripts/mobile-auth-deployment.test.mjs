import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

async function readRepositoryFile(file) {
  return readFile(path.join(repositoryRoot, file), 'utf8');
}

function locationBlock(router, marker) {
  const start = router.indexOf(marker);
  assert.ok(start >= 0, `Missing router location: ${marker}`);
  const end = router.indexOf('\n    location ', start + marker.length);
  return router.slice(start, end);
}

test('production routes native bearer authentication directly to Learning OS', async () => {
  const [router, workflow] = await Promise.all([
    readRepositoryFile('deploy/prod-router.conf.template'),
    readRepositoryFile('.github/workflows/deploy-prod.yml'),
  ]);

  const mobileBlock = locationBlock(
    router,
    'location ~ ^/api/(?:auth/tokens(?:/|$)|card-review-events(?:/|$)|me(?:/|$)|sync(?:/|$))'
  );
  assert.ok(mobileBlock.includes('proxy_pass $learning_os_upstream;'));
  assert.ok(mobileBlock.includes('proxy_set_header Authorization $http_authorization;'));
  assert.ok(mobileBlock.includes('proxy_set_header X-Convo-Lab-User-Id "";'));
  assert.ok(!mobileBlock.includes('proxy_set_header Authorization "";'));

  for (const marker of [
    'https://convo-lab.com/api/auth/tokens)',
    'https://convo-lab.com/api/me)',
    'https://convo-lab.com/api/auth/tokens/current)',
    'https://convo-lab.com/api/card-review-events/batch)',
  ]) {
    assert.ok(workflow.includes(marker), `Missing native route smoke: ${marker}`);
  }
  for (const marker of [
    'https://convo-lab.com/api/me/password',
    'https://convo-lab.com/api/sync/feed?domain=flashcards&resource_type=card',
  ]) {
    assert.ok(workflow.includes(marker), `Missing protected native route smoke: ${marker}`);
  }
  assert.match(
    workflow,
    /--request PUT[\s\S]*https:\/\/convo-lab\.com\/api\/me\/password/u,
    'Password smoke must use the endpoint-supported PUT method'
  );
});

test('native content routes preserve bearer tokens without trusting browser identity', async () => {
  const router = await readRepositoryFile('deploy/prod-router.conf.template');

  for (const marker of [
    'location ~ "^/api/study/imports/',
    'location ~ "^/api/study/media/',
    'location ~ ^/api/study(?:/|$)',
    'location ~ "^/api/daily-audio-practice/',
    'location ~ ^/api/daily-audio-practice(?:/|$)',
  ]) {
    const block = locationBlock(router, marker);
    assert.ok(
      block.includes('proxy_set_header Authorization $http_authorization;'),
      `${marker} must preserve Authorization`
    );
    assert.ok(
      block.includes('proxy_set_header X-Convo-Lab-User-Id "";'),
      `${marker} must clear the browser identity header`
    );
  }
});

test('invite registration is routed to Learning OS without trusting client identity', async () => {
  const router = await readRepositoryFile('deploy/prod-router.conf.template');
  const block = locationBlock(router, 'location ^~ /api/convolab/auth/');

  assert.ok(block.includes('proxy_pass $learning_os_upstream;'));
  assert.ok(block.includes('proxy_set_header Authorization "";'));
  assert.ok(block.includes('proxy_set_header X-Convo-Lab-User-Id "";'));
});
