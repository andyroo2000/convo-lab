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
