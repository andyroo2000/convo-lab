import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(repositoryRoot, '.github/workflows/deploy-prod.yml');
const migrationInventoryCopy =
  'COPY --from=server-builder /app/server/src/migration/backendMigrationInventory.json ./dist/server/src/migration/backendMigrationInventory.json';
const localeResourcesCopy =
  'COPY --from=server-builder /app/server/src/i18n/locales ./dist/server/src/i18n/locales';

async function readDeployment() {
  const source = await readFile(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  const deployStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Deploy to droplet'
  );

  assert.equal(typeof deployStep?.run, 'string');
  return { source, script: deployStep.run };
}

test('the production deployment wrapper and remote script remain valid Bash', async () => {
  const { script } = await readDeployment();
  await execFileAsync('bash', ['-n', '-c', script]);

  const heredocMarker = "cat << 'ENDSSH'";
  const heredocStart = script.indexOf(heredocMarker);
  const remoteScriptStart = script.indexOf('\n', heredocStart) + 1;
  const remoteScriptEnd = script.indexOf('\nENDSSH\n', remoteScriptStart);

  assert.ok(heredocStart >= 0);
  assert.ok(remoteScriptStart > heredocStart);
  assert.ok(remoteScriptEnd > remoteScriptStart);
  await execFileAsync('bash', [
    '-n',
    '-c',
    script.slice(remoteScriptStart, remoteScriptEnd),
  ]);
});

test('the production workflow retains blue-green switching and rollback contracts', async () => {
  const { script } = await readDeployment();
  const switchStart = script.indexOf('router_role="$(docker inspect');
  const publicVerificationGate = script.indexOf(
    'if ! verify_public_health || ! verify_public_google_oauth; then',
    switchStart
  );
  const activeColorWrite = script.indexOf(
    'write_active_color "$inactive_color"',
    publicVerificationGate
  );

  assert.ok(switchStart >= 0);
  assert.ok(publicVerificationGate > switchStart);
  assert.ok(activeColorWrite > publicVerificationGate);

  const switchBlock = script.slice(switchStart, activeColorWrite);
  assert.match(
    switchBlock,
    /if \[ "\$router_role" = "router" \]; then[\s\S]*?render_router_config "\$inactive_color"\s+reload_router/
  );
  assert.match(
    switchBlock,
    /else\s+echo ".*Starting router for new production stack.*"\s+render_router_config "\$inactive_color"\s+\$COMPOSE up -d --no-deps router\s+if ! wait_for_container_health convolab-server; then/
  );
  assert.match(
    switchBlock,
    /if ! verify_public_health \|\| ! verify_public_google_oauth; then[\s\S]*if ! rollback_router "\$active_color"; then/
  );
});

test('the production workflow executes migrations before starting the inactive server', async () => {
  const { script } = await readDeployment();
  const migrateDeploy = script.indexOf('npx prisma migrate deploy');
  const inactiveServerStart = script.indexOf('$COMPOSE up -d --no-deps "server-$inactive_color"');

  assert.ok(!script.includes('prisma migrate resolve --applied'));
  assert.ok(migrateDeploy >= 0);
  assert.ok(inactiveServerStart > migrateDeploy);
});

test('the production workflow verifies the analytics token before switching traffic', async () => {
  const { script } = await readDeployment();
  const inactiveServerHealthy = script.indexOf(
    'wait_for_container_health "convolab-server-$inactive_color"'
  );
  const analyticsPreflight = script.indexOf(
    'Learning OS analytics token preflight passed.',
    inactiveServerHealthy
  );
  const switchStart = script.indexOf('router_role="$(docker inspect', analyticsPreflight);
  const preflightBlock = script.slice(inactiveServerHealthy, analyticsPreflight);

  assert.ok(inactiveServerHealthy >= 0);
  assert.ok(analyticsPreflight > inactiveServerHealthy);
  assert.ok(switchStart > analyticsPreflight);
  assert.match(preflightBlock, /127\.0\.0\.1:\$\{port\}\/api\/tools\/analytics/);
  assert.match(preflightBlock, /signal: AbortSignal\.timeout\(10_000\)/);
  assert.match(preflightBlock, /response\.status !== 204/);
  assert.doesNotMatch(preflightBlock, /Authorization:/);
  assert.doesNotMatch(preflightBlock, /X-Convo-Lab-User-/);
});

test('the production workflow rejects unexpected containers without legacy cutover behavior', async () => {
  const { source, script } = await readDeployment();

  assert.match(source, /convolab-server exists without the expected router role/);
  assert.match(source, /Refusing to replace an unexpected production container automatically/);
  assert.match(
    script,
    /elif docker inspect convolab-server[^]*?then\s+echo ".*without the expected router role.*"\s+echo "Refusing[^]*?"\s+echo ".*Removing the inactive app[^]*?"\s+if ! docker rm -f "convolab-server-\$inactive_color"; then[^]*?fi\s+exit 1\s+else/
  );

  for (const retiredContract of [
    'restore_legacy_app',
    'legacy_cutover',
    'convolab-server-legacy-cutover',
    'Performing one-time cutover',
    'docker rename convolab-server',
  ]) {
    assert.ok(
      !source.includes(retiredContract),
      `Found retired production cutover contract: ${retiredContract}`
    );
  }
});

test('the production images include the backend migration inventory', async () => {
  for (const dockerfile of ['Dockerfile', 'server/Dockerfile.worker']) {
    const source = await readFile(path.join(repositoryRoot, dockerfile), 'utf8');
    assert.ok(source.includes(migrationInventoryCopy), `${dockerfile} omits the runtime inventory`);
  }
});

test('the production images include runtime translation resources', async () => {
  for (const dockerfile of ['Dockerfile', 'server/Dockerfile.worker']) {
    const source = await readFile(path.join(repositoryRoot, dockerfile), 'utf8');
    assert.ok(source.includes(localeResourcesCopy), `${dockerfile} omits translation resources`);
  }
});
