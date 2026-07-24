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

async function readDeployment() {
  const source = await readFile(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  const deployStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Deploy to droplet'
  );

  assert.equal(typeof deployStep?.run, 'string');
  return { source, script: deployStep.run };
}

test('the production workflow accepts only immutable static frontend tags', async () => {
  const workflow = YAML.parse(await readFile(workflowPath, 'utf8'));
  const imageInput = workflow.on.workflow_dispatch.inputs.image_tag;
  const validateStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Validate image tag'
  );

  assert.equal(imageInput.required, true);
  assert.equal(imageInput.type, 'string');
  assert.equal(imageInput.default, undefined);
  assert.equal(validateStep.env.IMAGE_TAG, '${{ inputs.image_tag }}');
  assert.match(validateStep.run, /\^main-\[0-9a-f\]\{40\}\$/u);
});

test('the production deployment wrapper and remote script remain valid Bash', async () => {
  const { source, script } = await readDeployment();
  await execFileAsync('bash', ['-n', '-c', script]);
  assert.doesNotMatch(script, /\$\{\{/u);

  for (const contract of [
    'DEPLOY_IMAGE_TAG: ${{ inputs.image_tag }}',
    'DEPLOY_GH_PAT: ${{ secrets.GH_PAT }}',
    'DEPLOY_GHCR_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
    'DEPLOY_GHCR_ACTOR: ${{ github.actor }}',
    "printf 'IMAGE_TAG=%q\\n' \"$DEPLOY_IMAGE_TAG\"",
    "printf 'GH_PAT=%q\\n' \"$DEPLOY_GH_PAT\"",
    "printf 'GHCR_TOKEN=%q\\n' \"$DEPLOY_GHCR_TOKEN\"",
    "printf 'GHCR_ACTOR=%q\\n' \"$DEPLOY_GHCR_ACTOR\"",
  ]) {
    assert.ok(source.includes(contract), `Missing expression-safe deployment contract: ${contract}`);
  }

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
  const publicVerificationGate = script.indexOf('if ! verify_public_health \\', switchStart);
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
    /if ! verify_public_health \\\s+\|\| ! verify_public_static_frontend \\\s+\|\| ! verify_public_learning_os_browser_route; then[\s\S]*if ! rollback_router "\$active_color"; then/
  );
});

test('the production frontend deploy does not own backend migrations or secrets', async () => {
  const { script } = await readDeployment();
  const inactiveServerStart = script.indexOf('$COMPOSE up -d --no-deps "server-$inactive_color"');

  assert.ok(inactiveServerStart >= 0);
  assert.doesNotMatch(script, /npx prisma|OPENAI_API_KEY|FISH_AUDIO_API_KEY/u);
  assert.doesNotMatch(script, /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/u);
  assert.doesNotMatch(script, /\$COMPOSE up -d postgres redis/u);
  assert.doesNotMatch(script, /docker (?:start|stop) convolab-redis/u);
});

test('the production workflow verifies static and API contracts before committing the switch', async () => {
  const { script } = await readDeployment();
  const switchStart = script.indexOf('router_role="$(docker inspect');
  const staticSmoke = script.indexOf('verify_public_static_frontend', switchStart);
  const learningOsSmoke = script.indexOf(
    'verify_public_learning_os_browser_route',
    staticSmoke
  );
  const activeColorWrite = script.indexOf('write_active_color "$inactive_color"', learningOsSmoke);

  assert.ok(switchStart >= 0);
  assert.ok(staticSmoke > switchStart);
  assert.ok(learningOsSmoke > staticSmoke);
  assert.ok(activeColorWrite > learningOsSmoke);
});

test('the production workflow waits for the public router to converge on the static runtime', async () => {
  const { script, source } = await readDeployment();
  const helperStart = script.indexOf('verify_public_static_frontend()');
  const helperEnd = script.indexOf('verify_public_learning_os_browser_route()', helperStart);
  const helper = script.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0);
  assert.match(helper, /for i in \{1\.\.20\}; do/u);
  assert.match(helper, /\.\/deploy\/smoke-static-frontend\.sh https:\/\/convo-lab\.com/u);
  assert.match(helper, /waiting for router convergence/u);
  assert.match(helper, /sleep 3/u);
  assert.match(helper, /return 1/u);
  assert.match(
    source,
    /verify_public_health\(\)[\s\S]*curl --fail --silent --show-error \\\s+--connect-timeout 5 \\\s+--max-time 15/u
  );
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

test('production colors use the static frontend and isolated deployment tools', async () => {
  const compose = YAML.parse(
    await readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8')
  );
  const frontend = compose['x-frontend-service'];
  const tools = compose.services['deployment-tools'];

  assert.equal(
    frontend.image,
    'ghcr.io/andyroo2000/convolab-frontend:${CONVOLAB_FRONTEND_IMAGE_TAG:-latest}'
  );
  assert.equal(frontend.environment, undefined);
  assert.equal(frontend.volumes, undefined);
  assert.equal(frontend.depends_on, undefined);
  assert.equal(frontend.mem_limit, '128m');
  assert.equal(compose['x-server-service'], undefined);
  assert.equal(compose['x-server-environment'], undefined);
  assert.equal(compose.services.redis, undefined);
  assert.deepEqual(compose.services['server-blue']['<<'], frontend);
  assert.equal(compose.services['server-blue'].container_name, 'convolab-server-blue');
  assert.deepEqual(compose.services['server-green']['<<'], frontend);
  assert.equal(compose.services['server-green'].container_name, 'convolab-server-green');
  assert.equal(
    tools.image,
    'node:20-alpine@sha256:658d0f63e501824d6c23e06d4bb95c71e7d704537c9d9272f488ac03a370d448'
  );
  assert.deepEqual(tools.profiles, ['deployment']);
  assert.equal(tools.container_name, 'convolab-deployment-tools');
});

test('the Learning OS deployment does not borrow Node from the frontend runtime', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  assert.match(workflow, /DEPLOYMENT_TOOLS_CONTAINER="convolab-deployment-tools"/u);
  assert.match(workflow, /\$COMPOSE --profile deployment up -d --no-deps deployment-tools/u);
  assert.match(workflow, /wait_for_health "\$DEPLOYMENT_TOOLS_CONTAINER"/u);
  assert.match(workflow, /docker rm -f "\$DEPLOYMENT_TOOLS_CONTAINER"/u);
  assert.doesNotMatch(
    workflow,
    /docker exec(?:\s|\\\n)+(?:-[^\n]+\n\s+)*"convolab-server-\$active_color"[\s\S]{0,80}\bnode\b/u
  );
});
