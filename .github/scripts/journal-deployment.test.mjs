import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('journal requests reach the private API with browser and mobile authentication', async () => {
  const router = await readFile(new URL('../../deploy/prod-router.conf.template', import.meta.url), 'utf8');
  const marker = 'location ~ ^/api/journal(?:/|$)';
  const start = router.indexOf(marker);
  assert.ok(start >= 0 && start < router.indexOf('location ~ ^/api/ {'));
  const block = router.slice(start, router.indexOf('}', start));
  assert.match(block, /proxy_pass \$learning_os_upstream;/u);
  assert.match(block, /proxy_set_header Authorization \$http_authorization;/u);
  assert.match(block, /proxy_set_header X-Convo-Lab-User-Id "";/u);
  assert.match(block, /proxy_set_header X-Forwarded-Proto \$proxy_x_forwarded_proto;/u);
  assert.match(block, /client_max_body_size 256k;/u);
});

test('verification smoke waits for token-rotating mail retries before issuing its test token', async () => {
  const script = await readFile(new URL('./smoke-auth-signup-verification-lifecycle.sh', import.meta.url), 'utf8');
  const waiting = script.indexOf('$pendingMail = DB::table("jobs")');
  const count = script.indexOf('echo "AUTH_SMOKE_TOKEN_COUNT="');
  const issue = script.indexOf('app(App\\Domain\\Auth\\Actions\\IssueConvoLabVerificationTokenAction::class)');
  assert.ok(waiting >= 0 && waiting < count && count < issue);
  const gate = script.slice(waiting, issue);
  assert.match(gate, /"allowed_classes" => false/u);
  assert.match(gate, /\["displayName"\].*SendConvoLabVerificationEmail::class/u);
  assert.match(gate, /\["userId"\] \?\? null\) === \$userId/u);
  assert.match(gate, /\$userId === null \|\| \$pendingMail \? 0/u);
});
