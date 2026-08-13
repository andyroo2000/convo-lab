import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const clientPackageJson = JSON.parse(
  readFileSync(resolve(rootDir, 'client/package.json'), 'utf8')
);
const sharedPackageJson = JSON.parse(
  readFileSync(resolve(rootDir, 'shared/package.json'), 'utf8')
);
const workflow = YAML.parse(
  readFileSync(resolve(rootDir, '.github/workflows/npm-audit.yml'), 'utf8')
);

test('CI rejects high or critical advisories in the committed all-dependency lockfile', () => {
  assert.equal(
    packageJson.scripts['audit:dependencies'],
    'npm audit --package-lock-only --ignore-scripts --audit-level=high'
  );
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.audit['timeout-minutes'], 5);

  const auditStep = workflow.jobs.audit.steps.find(
    (step) => step.name === 'Reject high or critical dependency advisories'
  );
  assert.ok(auditStep, 'dependency audit workflow must include the advisory rejection step');
  assert.equal(auditStep.run, 'npm run audit:dependencies');

  const toolingJob = workflow.jobs['tooling-contracts'];
  assert.ok(toolingJob, 'dependency audit workflow must include the tooling contract job');
  assert.equal(toolingJob['timeout-minutes'], 10);
  assert.deepEqual(
    toolingJob.steps.filter((step) => step.run).map((step) => step.run),
    [
      'npm ci --ignore-scripts',
      'node --test .github/scripts/dependency-audit.test.mjs',
      'npm run test:icons --workspace=client',
    ]
  );
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--omit(?:=|\s)/);
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--force/);
});

test('FSRS scheduling stays in the client-only Japanese Time Practice feature', () => {
  assert.equal(clientPackageJson.dependencies['ts-fsrs'], '^5.3.3');
  assert.equal(sharedPackageJson.dependencies?.['ts-fsrs'], undefined);
});
