import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('staging publishes both rollback and static frontend images', async () => {
  const workflowSource = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy.yml'),
    'utf8'
  );
  const workflow = YAML.parse(workflowSource);
  const buildJob = workflow.jobs['build-and-push'];

  assert.deepEqual(buildJob.strategy.matrix.include, [
    {
      runtime: 'combined',
      image: 'convolab-server',
      dockerfile: 'Dockerfile',
      cache_scope: 'convolab-server',
    },
    {
      runtime: 'static frontend',
      image: 'convolab-frontend',
      dockerfile: 'Dockerfile.frontend',
      cache_scope: 'convolab-frontend',
    },
  ]);
  assert.equal(workflow.jobs.deploy.needs, 'build-and-push');
  assert.match(workflowSource, /images: \$\{\{ env\.IMAGE_PREFIX \}\}\/\$\{\{ matrix\.image \}\}/u);
  assert.match(workflowSource, /file: \$\{\{ matrix\.dockerfile \}\}/u);
  assert.match(workflowSource, /scope=\$\{\{ matrix\.cache_scope \}\}/u);
});

test('staging runs only the static frontend with stable routing identity', async () => {
  const compose = YAML.parse(
    await readFile(path.join(repositoryRoot, 'docker-compose.stage.yml'), 'utf8')
  );
  const service = compose.services['server-stage'];

  assert.deepEqual(Object.keys(compose.services), ['server-stage']);
  assert.equal(
    service.image,
    'ghcr.io/andyroo2000/convolab-frontend:${CONVOLAB_FRONTEND_IMAGE_TAG:-latest}'
  );
  assert.equal(service.container_name, 'convolab-server-stage');
  assert.deepEqual(service.ports, ['3002:3001']);
  assert.deepEqual(service.networks['health-network'].aliases, ['convolab-server-stage']);
  assert.equal(service.environment, undefined);
  assert.equal(service.volumes, undefined);
  assert.equal(service.depends_on, undefined);
  assert.equal(service.mem_limit, '128m');
  assert.equal(service.healthcheck.start_period, '5s');
});

test('staging deployment has no retired backend startup path', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy.yml'),
    'utf8'
  );

  assert.match(workflow, /CONVOLAB_FRONTEND_IMAGE_TAG/u);
  assert.match(
    workflow,
    /\.\/deploy\/smoke-static-frontend\.sh https:\/\/stage\.convo-lab\.com/u
  );
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|FISH_AUDIO_API_KEY|LLM_PROVIDER/u);
  assert.doesNotMatch(workflow, /postgres-stage|redis-stage|npx prisma|failed_migration/u);
  assert.match(workflow, /down --remove-orphans/u);
  assert.doesNotMatch(workflow, /down [^\n]*(?:--volumes|-v)(?:\s|$)/u);
});

test('production uses the static runtime after the staging rehearsal', async () => {
  const productionCompose = await readFile(
    path.join(repositoryRoot, 'docker-compose.prod.yml'),
    'utf8'
  );

  assert.match(
    productionCompose,
    /image: ghcr\.io\/andyroo2000\/convolab-frontend:\$\{CONVOLAB_FRONTEND_IMAGE_TAG:-latest\}/u
  );
  assert.doesNotMatch(productionCompose, /convolab-server:\$\{CONVOLAB_IMAGE_TAG/u);
});
