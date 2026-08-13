import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(
  repositoryRoot,
  '.github/workflows/deploy-learning-os-prod.yml'
);
const resolverPath = path.join(
  repositoryRoot,
  '.github/scripts/resolve-oci-platform-digest.mjs'
);

function resolvePlatformDigest(manifest, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolverPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr));
    });
    child.stdin.end(JSON.stringify(manifest));
  });
}

async function readDeployment() {
  const source = await readFile(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  const deployStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Deploy Learning OS'
  );

  assert.equal(typeof deployStep?.run, 'string');
  return { source, workflow, script: deployStep.run };
}

test('the production Learning OS deploy requires a validated OCI digest', async () => {
  const { source, workflow } = await readDeployment();
  const digestInput = workflow.on.workflow_dispatch.inputs.image_digest;
  const validateStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === 'Validate inputs'
  );

  assert.equal(digestInput.required, true);
  assert.equal(digestInput.type, 'string');
  assert.equal(digestInput.default, undefined);
  assert.equal(validateStep.env.IMAGE_DIGEST, '${{ inputs.image_digest }}');
  assert.match(validateStep.run, /\^sha256:\[0-9a-f\]\{64\}\$/u);
  assert.ok(source.includes('IMAGE_DIGEST: ${{ inputs.image_digest }}'));
  assert.ok(source.includes('EXPECTED_IMAGE_DIGEST=%q'));
});

test('the remote deploy is valid Bash and pins Compose to the expected digest', async () => {
  const { script } = await readDeployment();
  await execFileAsync('bash', ['-n', '-c', script]);

  const heredocMarker = "<< 'ENDSSH'";
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

  const compose = YAML.parse(
    await readFile(path.join(repositoryRoot, 'docker-compose.prod.yml'), 'utf8')
  );
  assert.equal(
    compose['x-learning-os-service'].image,
    '${LEARNING_OS_IMAGE_REFERENCE:-ghcr.io/andyroo2000/learning-os:${LEARNING_OS_IMAGE_TAG:-latest}}'
  );
  assert.ok(script.includes('upsert_env LEARNING_OS_IMAGE_DIGEST "$EXPECTED_IMAGE_DIGEST"'));
  assert.ok(script.includes('upsert_env LEARNING_OS_IMAGE_REFERENCE'));
});

test('the deploy resolves OCI indexes and verifies the tag before migrations', async () => {
  const { source } = await readDeployment();

  for (const contract of [
    'resolve_expected_platform_digest() {',
    'docker manifest inspect --verbose "$desired_learning_os_reference"',
    'EXPECTED_PLATFORM_DIGEST',
    'resolve-oci-platform-digest.mjs',
    'verify_local_learning_os_image "$desired_learning_os_reference"',
    'verify_local_learning_os_image "$desired_learning_os_tag"',
    'verified_learning_os_image_id=',
    'RepoDigests',
  ]) {
    assert.ok(source.includes(contract), `Missing image integrity contract: ${contract}`);
  }

  const login = source.indexOf('docker login ghcr.io');
  const digestPull = source.indexOf(
    'docker pull "$desired_learning_os_reference"',
    login
  );
  const tagPull = source.indexOf('docker pull "$desired_learning_os_tag"', digestPull);
  const pinnedVerification = source.indexOf(
    'verify_local_learning_os_image "$desired_learning_os_reference"',
    tagPull
  );
  const tagVerification = source.indexOf(
    'verify_local_learning_os_image "$desired_learning_os_tag"',
    pinnedVerification
  );
  const migration = source.indexOf('php artisan migrate --force', tagVerification);

  assert.ok(login >= 0);
  assert.ok(digestPull > login);
  assert.ok(tagPull > digestPull);
  assert.ok(pinnedVerification > tagPull);
  assert.ok(tagVerification > pinnedVerification);
  assert.ok(migration > tagVerification);
  assert.doesNotMatch(
    source,
    /\$COMPOSE pull learning-os learning-os-worker learning-os-scheduler/u
  );
});

test('the OCI resolver distinguishes image indexes from platform manifests', async () => {
  const indexDigest = `sha256:${'1'.repeat(64)}`;
  const amd64Digest = `sha256:${'2'.repeat(64)}`;
  const arm64Digest = `sha256:${'3'.repeat(64)}`;
  const index = [
    {
      Descriptor: {
        digest: amd64Digest,
        platform: { os: 'linux', architecture: 'amd64' },
      },
    },
    {
      Descriptor: {
        digest: arm64Digest,
        platform: { os: 'linux', architecture: 'arm64' },
      },
    },
  ];

  assert.equal(
    await resolvePlatformDigest(index, {
      EXPECTED_IMAGE_DIGEST: indexDigest,
      RUNTIME_OS: 'linux',
      RUNTIME_ARCH: 'amd64',
    }),
    amd64Digest
  );
  assert.equal(
    await resolvePlatformDigest(index[0], {
      EXPECTED_IMAGE_DIGEST: amd64Digest,
      RUNTIME_OS: 'linux',
      RUNTIME_ARCH: 'amd64',
    }),
    amd64Digest
  );
  await assert.rejects(
    resolvePlatformDigest(index[0], {
      EXPECTED_IMAGE_DIGEST: indexDigest,
      RUNTIME_OS: 'linux',
      RUNTIME_ARCH: 'amd64',
    }),
    /Single-platform manifest did not preserve the expected digest/u
  );
  await assert.rejects(
    resolvePlatformDigest(index, {
      EXPECTED_IMAGE_DIGEST: indexDigest,
      RUNTIME_OS: 'linux',
      RUNTIME_ARCH: 's390x',
    }),
    /found 0/u
  );
});

test('API, worker, and scheduler reuse and post-switch checks require verified image content', async () => {
  const { source } = await readDeployment();

  assert.ok(source.includes('container_uses_verified_learning_os_image() {'));
  assert.ok(source.includes('verify_learning_os_container_image() {'));
  assert.ok(source.includes('container_image_id='));
  assert.ok(source.includes('[ "$container_image_id" = "$verified_learning_os_image_id" ]'));
  assert.ok(source.includes('image_has_expected_repo_digest "$container_image_id"'));

  const reconcile = source.indexOf(
    'ensure_learning_os_service learning-os learning-os-api'
  );
  const apiVerification = source.indexOf(
    'verify_learning_os_container_image learning-os-api',
    reconcile
  );
  const workerVerification = source.indexOf(
    'verify_learning_os_container_image learning-os-worker',
    apiVerification
  );
  const schedulerVerification = source.indexOf(
    'verify_learning_os_container_image learning-os-scheduler',
    workerVerification
  );
  const firstHealthGate = source.indexOf('wait_for_health learning-os-api', reconcile);

  assert.ok(reconcile >= 0);
  assert.ok(apiVerification > reconcile);
  assert.ok(workerVerification > apiVerification);
  assert.ok(schedulerVerification > workerVerification);
  assert.ok(firstHealthGate > schedulerVerification);
  assert.match(
    source,
    /if container_uses_verified_learning_os_image "\$container" \\\n+\s+&& \[ "\$running" = true \]/u
  );
});
