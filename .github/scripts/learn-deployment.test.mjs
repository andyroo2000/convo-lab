import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Learn reaches the gated private API before the generic API fallback', async () => {
  const router = await readFile(new URL('../../deploy/prod-router.conf.template', import.meta.url), 'utf8');
  const start = router.indexOf('location ~ ^/api/learn(?:/|$)');
  assert.ok(start >= 0 && start < router.indexOf('location ~ ^/api/ {'));
  const block = router.slice(start, router.indexOf('}', start));
  assert.match(block, /proxy_pass \$learning_os_upstream;/u);
  assert.match(block, /proxy_set_header Authorization \$http_authorization;/u);
  assert.match(block, /proxy_set_header X-Convo-Lab-User-Id "";/u);
  assert.match(block, /proxy_set_header X-Forwarded-Proto \$proxy_x_forwarded_proto;/u);
  assert.match(block, /client_max_body_size 256k;/u);
  assert.match(block, /proxy_read_timeout 180s;/u);
});
