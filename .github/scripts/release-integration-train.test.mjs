import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '../..');
const workflowFile = path.join(root, '.github/workflows/release-integration-train.yml');
const pinsFile = path.join(root, '.github/release-integration/components.json');

test('integration train is manual/scheduled, exact-pinned, temporary, and never auto-merges', async () => {
  const source = await readFile(workflowFile, 'utf8');
  const workflow = YAML.parse(source);
  const pins = JSON.parse(await readFile(pinsFile, 'utf8'));

  assert.ok(workflow.on.workflow_dispatch !== undefined);
  assert.equal(workflow.on.schedule.length, 1);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.prepare.permissions.contents, 'write');
  assert.equal(workflow.jobs.cleanup.permissions.contents, 'write');
  for (const job of ['fixture-bytes', 'provider-contracts', 'web-contracts', 'ios-contracts']) {
    assert.equal(workflow.jobs[job].permissions, undefined);
    assert.doesNotMatch(
      YAML.stringify(workflow.jobs[job]),
      /actions\/cache|cache:\s/u,
      `${job} must not expose a shared cache to exact-SHA component code`
    );
  }
  assert.match(source, /integration\/compatibility-\$\{\{ github\.run_id \}\}/u);
  assert.match(source, /gh api -X DELETE/u);
  assert.doesNotMatch(source, /gh pr merge|merge-pull-request|workflow_run/u);

  for (const name of ['provider', 'web', 'ios']) {
    assert.match(pins.components[name].sha, /^[0-9a-f]{40}$/u);
    assert.match(source, new RegExp(`needs\\.prepare\\.outputs\\.${name}_sha`, 'u'));
    assert.ok(!path.isAbsolute(pins.components[name].fixtureDirectory));
    assert.match(
      source,
      new RegExp(`needs\\.prepare\\.outputs\\.${name}_fixture_directory`, 'u')
    );
  }
  assert.match(source, /verify-release-integration\.mjs/u);
  assert.match(source, /read-release-integration-pins\.mjs/u);
  assert.match(source, /CompatibilityPayloadContractFixtureTest\.php/u);
  assert.match(source, /learningOsCompatibilityContracts\.test\.ts/u);
  assert.match(source, /only-testing:ConvoLabTests\/APICompatibilityGoldenFixtureTests/u);
});
