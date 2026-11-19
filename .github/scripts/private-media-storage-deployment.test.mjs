import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import YAML from 'yaml';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('all persistent media writers share the cloud migration settings with a safe local default', async () => {
  const compose = YAML.parse(await read('docker-compose.prod.yml'), { merge: true });
  for (const service of ['learning-os', 'learning-os-worker', 'learning-os-scheduler']) {
    const env = compose.services[service].environment;
    assert.equal(env.APP_MEDIA_DRIVER, '${APP_MEDIA_DRIVER:-local}');
    assert.equal(env.APP_MEDIA_BUCKET, '${APP_MEDIA_BUCKET:-convolab-private-media}');
    assert.equal(env.APP_MEDIA_PREFIX, '${APP_MEDIA_PREFIX:-production}');
  }
});

test('storage configuration changes participate in API, worker and scheduler reconciliation', async () => {
  const workflow = await read('.github/workflows/deploy-learning-os-prod.yml');
  for (const key of ['APP_MEDIA_DRIVER', 'APP_MEDIA_BUCKET', 'APP_MEDIA_PREFIX']) {
    assert.ok(workflow.includes(`$(read_env_value ${key})`));
  }
  assert.ok(workflow.includes('private-media-$media_config_revision'));
});

test('unbundled tool clips retain a same-origin route to cloud playback', async () => {
  const dockerfile = await read('Dockerfile.frontend');
  const nginx = await read('deploy/frontend-nginx.conf');
  assert.ok(dockerfile.includes('RUN rm -rf /app/client/dist/tools-audio'));
  assert.ok(nginx.includes('location ~ ^/tools-audio/([A-Za-z0-9/_-]+\\.mp3)$'));
  assert.ok(nginx.includes('return 302 /api/tools-audio/play/$1;'));
});


test('invalid tool paths return 404 and deployment checks cloud playback before SSH', async () => {
  const nginx = await read('deploy/frontend-nginx.conf');
  const pattern = nginx.match(/location ~ (\^\/tools-audio\/[^ ]+) \{/u)?.[1];
  assert.ok(pattern);
  const route = new RegExp(pattern);
  assert.equal(route.test('/tools-audio/nested/clip-01.mp3'), true);
  for (const path of ['../secret.mp3', 'folder.with.dot/clip.mp3', 'clip.MP3', 'clip.json']) {
    assert.equal(route.test(`/tools-audio/${path}`), false);
  }
  assert.match(nginx, /location \/tools-audio\/ \{\s+return 404;/u);
  const workflow = YAML.parse(await read('.github/workflows/deploy-prod.yml'));
  const steps = workflow.jobs.deploy.steps;
  const gate = steps.findIndex((step) => step.name === 'Verify cloud tool audio is ready');
  assert.ok(gate > 0 && gate < steps.findIndex((step) => step.name === 'Setup SSH'));
  assert.match(steps[gate].run, /curl --fail.*--location/u);
});
