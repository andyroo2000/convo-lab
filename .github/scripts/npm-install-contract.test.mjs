import assert from 'node:assert/strict';
import { constants, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const clientPackageJson = JSON.parse(
  readFileSync(resolve(rootDir, 'client/package.json'), 'utf8')
);
const packageLock = JSON.parse(readFileSync(resolve(rootDir, 'package-lock.json'), 'utf8'));
const workflow = YAML.parse(
  readFileSync(resolve(rootDir, '.github/workflows/npm-install.yml'), 'utf8')
);

test('root package owns the Husky lifecycle dependency', () => {
  assert.equal(packageJson.scripts.prepare, 'husky');
  assert.equal(packageJson.devDependencies.husky, '^9.1.7');
});

test('tracked hooks preserve the intended commit and push gates', () => {
  const hooks = [
    ['pre-commit', 'npx lint-staged'],
    ['pre-push', 'npm run precheck:full'],
  ];

  for (const [name, command] of hooks) {
    const hookPath = resolve(rootDir, '.husky', name);
    const lines = readFileSync(hookPath, 'utf8').split(/\r?\n/);
    assert.ok(lines.includes(command), `${name} must run ${command}`);
    assert.notEqual(statSync(hookPath).mode & constants.S_IXUSR, 0, `${name} must remain executable`);
  }
});

test('the committed lockfile pins matching Vitest and V8 coverage versions', () => {
  const clientLock = packageLock.packages.client;
  const vitestVersion = clientPackageJson.devDependencies.vitest;
  const coverageVersion = clientPackageJson.devDependencies['@vitest/coverage-v8'];

  assert.match(vitestVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(coverageVersion, vitestVersion);
  assert.equal(clientLock.devDependencies.vitest, vitestVersion);
  assert.equal(clientLock.devDependencies['@vitest/coverage-v8'], coverageVersion);
});

test('CI runs the complete frontend quality gate after one plain clean install', () => {
  const qualityJob = workflow.jobs.quality;

  assert.equal(workflow.name, 'Frontend Quality Gate');
  assert.equal(workflow.on.pull_request, null);
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(Object.hasOwn(workflow.on.push, 'paths'), false);
  assert.equal(Object.hasOwn(workflow.on.push, 'paths-ignore'), false);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(
    workflow.concurrency.group,
    'frontend-quality-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}'
  );
  assert.equal(
    workflow.concurrency['cancel-in-progress'],
    "${{ github.event_name == 'pull_request' }}"
  );
  assert.equal(qualityJob.name, 'Type, lint, format, tests, and coverage');
  assert.equal(qualityJob['timeout-minutes'], 15);

  const runSteps = qualityJob.steps.filter((step) => step.run).map((step) => step.run);
  assert.deepEqual(runSteps, [
    'npm ci',
    'node --test .github/scripts/npm-install-runtime.node-test.mjs',
    'npm run type-check',
    'npm run lint',
    'npm run format:check',
    'npm run test:coverage --workspace=client -- --reporter=default --reporter=junit --outputFile.junit=test-results/vitest-junit.xml',
  ]);

  const artifactStep = qualityJob.steps.find(
    (step) => step.uses === 'actions/upload-artifact@v4'
  );
  assert.equal(
    artifactStep.if,
    "${{ failure() && hashFiles('client/test-results/**') != '' }}"
  );
  assert.equal(artifactStep.with.path, 'client/test-results\nclient/coverage\n');
  assert.equal(artifactStep.with['retention-days'], 7);
});
