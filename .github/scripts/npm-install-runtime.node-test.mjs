import assert from 'node:assert/strict';
import { constants, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('plain npm install activates the committed Husky hooks', () => {
  const configuredPath = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  assert.equal(configuredPath.status, 0, configuredPath.stderr);
  assert.equal(configuredPath.stdout.trim(), '.husky/_');

  assert.ok(existsSync(resolve(rootDir, '.husky/_/h')), 'Husky dispatcher must be installed');

  for (const name of ['pre-commit', 'pre-push']) {
    const shimPath = resolve(rootDir, '.husky/_', name);
    assert.notEqual(
      statSync(shimPath).mode & constants.S_IXUSR,
      0,
      `${name} dispatcher must be installed and executable`
    );
  }
});
