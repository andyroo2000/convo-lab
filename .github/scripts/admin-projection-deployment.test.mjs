import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(
  repositoryRoot,
  '.github/workflows/deploy-learning-os-prod.yml'
);

test('production syncs the admin projection before browser-session admin smoke checks', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const migrationIndex = workflow.indexOf('php artisan migrate --force');
  const contentImportIndex = workflow.indexOf('php artisan content:import-convolab-episodes');
  const adminSyncIndex = workflow.indexOf('php artisan admin:sync-convolab');
  const browserSessionIndex = workflow.indexOf(
    'Disposable Learning OS content browser session established.'
  );

  assert.ok(migrationIndex >= 0);
  assert.ok(contentImportIndex > migrationIndex);
  assert.ok(adminSyncIndex > contentImportIndex);
  assert.ok(browserSessionIndex > adminSyncIndex);
  assert.match(workflow, /php artisan admin:sync-convolab[\s\S]*--source-database="\$source_db"[\s\S]*--allow-production/);
  assert.doesNotMatch(workflow, /admin:sync-convolab[\s\S]{0,300}--allow-empty-source/);
});

test('production smoke-gates canonical browser-session routes', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const browserSessionIndex = workflow.indexOf(
    'Disposable Learning OS content browser session established.'
  );
  const canonicalAdminIndex = workflow.indexOf(
    "fetch_learning_os_route \\\n                'Admin stats Learning OS'"
  );

  assert.doesNotMatch(workflow, /127\.0\.0\.1:8080\/api\/convolab\/admin\/stats/);
  for (const route of [
    '/api/convolab/admin/stats',
    '/api/convolab/admin/users?limit=1',
    '/api/convolab/admin/invite-codes?limit=1',
    '/api/convolab/admin/script-lab/courses',
    '/api/convolab/admin/script-lab/sentence-tests?limit=1',
    '/api/convolab/admin/avatars/speakers',
    '/api/convolab/admin/pronunciation-dictionaries',
  ]) {
    assert.ok(workflow.includes(route), `Missing production smoke route: ${route}`);
  }
  assert.ok(browserSessionIndex >= 0);
  assert.ok(canonicalAdminIndex > browserSessionIndex);
  assert.match(workflow, /\/api\/convolab\/admin\/users\/\$admin_user_id\/info/);
  assert.match(
    workflow,
    /\/api\/convolab\/admin\/avatars\/speaker\/\$admin_speaker_filename\/original/
  );
  assert.match(
    workflow,
    /mutate_learning_os_route[\s\\]+PUT[\s\\]+'\/api\/convolab\/admin\/pronunciation-dictionaries'/
  );
  assert.match(workflow, /Canonical admin browser-session read\/write smoke checks passed\./);
  assert.match(
    workflow,
    /mutate_learning_os_route[\s\\]+POST[\s\\]+'\/api\/convolab\/admin\/invite-codes'/
  );
  assert.match(
    workflow,
    /DELETE "\/api\/convolab\/admin\/invite-codes\/\$admin_invite_smoke_id"/
  );
  assert.match(
    workflow,
    /Canonical admin browser-session invite create\/delete smoke checks passed\./
  );
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/stats/);
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/users(?:[/?"])/);
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/invite-codes/);
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/avatars/);
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/pronunciation-dictionaries/);
  assert.doesNotMatch(workflow, /['"]\/api\/admin\/script-lab/);
  assert.doesNotMatch(workflow, /\bfetch_read_route\s*\(\)/);
  assert.doesNotMatch(workflow, /\bmutate_proxy_route\s*\(\)/);
});
