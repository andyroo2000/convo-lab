import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const workflow = readFileSync(resolve(rootDir, '.github/workflows/npm-audit.yml'), 'utf8');

test('CI rejects high or critical advisories in the committed all-dependency lockfile', () => {
  assert.equal(
    packageJson.scripts['audit:dependencies'],
    'npm audit --package-lock-only --ignore-scripts --audit-level=high'
  );
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\n\s+branches: \[main\]/);
  assert.match(workflow, /run: npm run audit:dependencies/);
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--omit(?:=|\s)/);
  assert.doesNotMatch(packageJson.scripts['audit:dependencies'], /--force/);
});
