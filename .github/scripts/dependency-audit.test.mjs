import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
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
  assert.equal(
    workflow.jobs.audit.steps.find((step) => step.name === 'Reject high or critical dependency advisories')
      .run,
    'npm run audit:dependencies'
  );
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--omit(?:=|\s)/);
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--force/);
});
