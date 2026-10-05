import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const clientPackageJson = JSON.parse(readFileSync(resolve(rootDir, 'client/package.json'), 'utf8'));
const sharedPackageJson = JSON.parse(readFileSync(resolve(rootDir, 'shared/package.json'), 'utf8'));
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

const clientRequire = createRequire(resolve(rootDir, 'client/package.json'));
const tailwindRequire = createRequire(clientRequire.resolve('tailwindcss'));

for (const consumer of ['chokidar', 'micromatch']) {
  const consumerRequire = createRequire(tailwindRequire.resolve(consumer));
  const braces = consumerRequire('braces');

  test(`${consumer} uses the reviewed, pinned braces security backport`, () => {
    const dependency = consumerRequire('braces/package.json');
    assert.equal(dependency.name, '@dieub/braces-depth-guard');
    assert.equal(dependency.version, '3.0.3-pn.3');
  });

  test(`${consumer} rejects excessive brace and parenthesis nesting before stack exhaustion`, () => {
    for (const [open, close] of [
      ['{', '}'],
      ['(', ')'],
    ]) {
      const pattern = open.repeat(4000) + 'a,b' + close.repeat(4000);
      for (const operation of ['parse', 'compile', 'expand', 'stringify']) {
        assert.throws(() => braces[operation](pattern), {
          name: 'SyntaxError',
          message: /exceeds max depth \(100\)/,
        });
      }
    }
  });

  test(`${consumer} guards direct AST traversal as well as string parsing`, () => {
    for (const operation of ['compile', 'expand', 'stringify']) {
      let ast = { type: 'text', value: 'a' };
      for (let depth = 0; depth < 150; depth += 1) {
        ast = { type: 'brace', nodes: [ast] };
      }
      assert.throws(() => braces[operation]({ type: 'root', nodes: [ast] }), {
        name: 'RangeError',
        message: /exceeds max depth \(100\)/,
      });
    }
  });

  test(`${consumer} preserves ordinary build-tool brace expansion`, () => {
    assert.deepEqual(braces.expand('src/{components,hooks}/**/*.{ts,tsx}'), [
      'src/components/**/*.ts',
      'src/components/**/*.tsx',
      'src/hooks/**/*.ts',
      'src/hooks/**/*.tsx',
    ]);
    assert.deepEqual(braces.expand('file{01..03}.ts'), ['file01.ts', 'file02.ts', 'file03.ts']);
    assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
    assert.equal(
      braces.stringify(braces.parse('src/{components,hooks}')),
      'src/{components,hooks}'
    );
  });
}
