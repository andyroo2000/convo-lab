import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('private readings reach Learning OS with browser identity and time for Sato generation', async () => {
  const router = await readFile(new URL('../../deploy/prod-router.conf.template', import.meta.url), 'utf8');
  const block = router.match(/location ~ \^\/api\/convolab\/readings\(\?:\/\|\$\) \{([^}]+)\}/u)?.[1];
  assert.ok(block, 'Readings must be routed before the static frontend fallback');
  assert.match(block, /proxy_pass \$learning_os_upstream;/u);
  assert.match(block, /proxy_set_header Authorization "";/u);
  assert.match(block, /proxy_set_header X-Convo-Lab-User-Id "";/u);
  assert.match(block, /proxy_read_timeout 180s;/u);
});
