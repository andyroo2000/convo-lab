import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(
  repositoryRoot,
  '.github/workflows/deploy-learning-os-prod.yml'
);

test('production syncs the admin projection before issuing an admin-scoped token', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const migrationIndex = workflow.indexOf('php artisan migrate --force');
  const contentImportIndex = workflow.indexOf('php artisan content:import-convolab-episodes');
  const adminSyncIndex = workflow.indexOf('php artisan admin:sync-convolab');
  const tokenIndex = workflow.indexOf('$user->createToken("convolab-proxy"');

  assert.ok(migrationIndex >= 0);
  assert.ok(contentImportIndex > migrationIndex);
  assert.ok(adminSyncIndex > contentImportIndex);
  assert.ok(tokenIndex > adminSyncIndex);
  assert.match(workflow, /php artisan admin:sync-convolab[\s\S]*--source-database="\$source_db"[\s\S]*--allow-production/);
  assert.doesNotMatch(workflow, /admin:sync-convolab[\s\S]{0,300}--allow-empty-source/);
  assert.match(workflow, /"admin:read",/);
  assert.match(workflow, /"admin:write",/);
});

test('production smoke-gates both the private admin API and public compatibility routes', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /127\.0\.0\.1:8080\/api\/convolab\/admin\/stats/);
  for (const route of [
    '/api/admin/stats',
    '/api/admin/users?limit=1',
    '/api/admin/invite-codes?limit=1',
  ]) {
    assert.ok(workflow.includes(route), `Missing production smoke route: ${route}`);
  }
  assert.match(workflow, /\/api\/admin\/users\/\$admin_user_id\/info/);
  assert.match(workflow, /Admin Learning OS read smoke checks passed\./);
  assert.match(workflow, /mutate_proxy_route POST '\/api\/admin\/invite-codes' '\{\}'/);
  assert.match(workflow, /DELETE "\/api\/admin\/invite-codes\/\$admin_invite_smoke_id"/);
  assert.match(workflow, /Admin Learning OS invite create\/delete smoke checks passed\./);
});
