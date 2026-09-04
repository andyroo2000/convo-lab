#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const INVALID_FIXTURE_NAMES = new Set(['', '.', '..']);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expectedDigest = (bytes) => bytes.toString('utf8').trim().split(/\s+/u)[0];

function fixtureBasename(value) {
  const name = path.posix.basename(value);
  if (INVALID_FIXTURE_NAMES.has(name)) throw new Error(`Invalid fixture path: ${value}`);
  return name;
}

function isNonEmptyString(value) {
  if (typeof value !== 'string') return false;
  return value.length > 0;
}

async function responseBytes(response, description) {
  if (!response.ok) throw new Error(`Unable to fetch ${description}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchRepositoryDefaultBranch(fetchImpl, repository, headers) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}`, { headers });
  if (!response.ok) throw new Error(`Unable to resolve ${repository}: HTTP ${response.status}`);
  const metadata = await response.json();
  if (!isNonEmptyString(metadata.default_branch)) {
    throw new Error(`${repository} did not return a default branch.`);
  }
  return metadata.default_branch;
}

async function fetchBranchSha(fetchImpl, repository, branch, headers) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error(`Unable to resolve ${repository} default branch: HTTP ${response.status}`);
  }
  const commit = await response.json();
  if (!SHA_PATTERN.test(commit.sha ?? '')) {
    throw new Error(`${repository} default branch did not resolve to a full commit SHA.`);
  }
  return commit.sha;
}

async function resolveMainSha(fetchImpl, repository, token) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error(`Invalid repository: ${repository}`);
  const headers = githubHeaders(token);
  const branch = await fetchRepositoryDefaultBranch(fetchImpl, repository, headers);
  return fetchBranchSha(fetchImpl, repository, branch, headers);
}

export async function readCurrentMainComponents(
  pinsFile = fileURLToPath(new URL('../release-integration/components.json', import.meta.url))
) {
  const pins = JSON.parse(await readFile(pinsFile, 'utf8'));
  if (pins.schemaVersion !== 1) throw new Error('Component pins must use schemaVersion 1.');
  return pins.components;
}

export async function resolveCurrentMainShas({ components, fetchImpl = fetch, token = '' }) {
  const entries = Object.entries(components ?? {});
  if (entries.map(([name]) => name).join(',') !== 'provider,web,ios') {
    throw new Error('Current-main audit requires provider, web, and iOS components.');
  }
  return Object.fromEntries(
    await Promise.all(
      entries.map(async ([name, component]) => [
        name,
        await resolveMainSha(fetchImpl, component.repository, token),
      ])
    )
  );
}

function rawUrl(component, sha, name) {
  return `https://raw.githubusercontent.com/${component.repository}/${sha}/${component.fixtureDirectory}/${name}`;
}

async function fetchFixture(fetchImpl, component, sha, name) {
  return responseBytes(await fetchImpl(rawUrl(component, sha, name)), `${component.repository}/${name}`);
}

async function readProviderManifest(fetchImpl, provider, providerSha) {
  const manifestBytes = await fetchFixture(fetchImpl, provider, providerSha, 'manifest-v1.json');
  const checksumBytes = await fetchFixture(fetchImpl, provider, providerSha, 'manifest-v1.sha256');
  if (sha256(manifestBytes) !== expectedDigest(checksumBytes)) {
    throw new Error('Provider current-main manifest checksum does not match its bytes.');
  }
  return {
    manifest: JSON.parse(manifestBytes.toString('utf8')),
    providerFiles: new Map([
      ['manifest-v1.json', manifestBytes],
      ['manifest-v1.sha256', checksumBytes],
    ]),
  };
}

async function readProviderFixture(fetchImpl, provider, providerSha, fixture) {
  const payloadName = fixtureBasename(fixture.path);
  const checksumName = fixtureBasename(fixture.checksumPath);
  const payload = await fetchFixture(fetchImpl, provider, providerSha, payloadName);
  const checksum = await fetchFixture(fetchImpl, provider, providerSha, checksumName);
  if (sha256(payload) !== fixture.sha256) {
    throw new Error(`Provider current-main checksum mismatch for ${fixture.id}.`);
  }
  if (expectedDigest(checksum) !== fixture.sha256) {
    throw new Error(`Provider current-main checksum mismatch for ${fixture.id}.`);
  }
  return { payloadName, checksumName, payload, checksum };
}

async function loadProviderFixtures({ fetchImpl, provider, providerSha, manifest, providerFiles }) {
  for (const fixture of manifest.fixtures ?? []) {
    const files = await readProviderFixture(fetchImpl, provider, providerSha, fixture);
    providerFiles.set(files.payloadName, files.payload);
    providerFiles.set(files.checksumName, files.checksum);
  }
}

async function verifyConsumerFixtures({
  fetchImpl,
  component,
  sha,
  fixtureNames,
  providerFiles,
  name,
}) {
  for (const fixtureName of fixtureNames) {
    const consumerBytes = await fetchFixture(fetchImpl, component, sha, fixtureName);
    if (!providerFiles.get(fixtureName)?.equals(consumerBytes)) {
      throw new Error(`${name} current-main fixture differs from provider: ${fixtureName}`);
    }
  }
}

export async function auditCurrentMainContracts({
  components,
  fetchImpl = fetch,
  token = '',
  shas,
} = {}) {
  const resolvedShas = shas ?? (await resolveCurrentMainShas({ components, fetchImpl, token }));
  const provider = components.provider;
  const { manifest, providerFiles } = await readProviderManifest(
    fetchImpl,
    provider,
    resolvedShas.provider
  );
  const fixtureNames = [
    'manifest-v1.json',
    'manifest-v1.sha256',
    ...(manifest.fixtures ?? []).flatMap((fixture) => [
      fixtureBasename(fixture.path),
      fixtureBasename(fixture.checksumPath),
    ]),
  ];
  await loadProviderFixtures({
    fetchImpl,
    provider,
    providerSha: resolvedShas.provider,
    manifest,
    providerFiles,
  });

  for (const name of ['web', 'ios']) {
    await verifyConsumerFixtures({
      fetchImpl,
      component: components[name],
      sha: resolvedShas[name],
      fixtureNames,
      providerFiles,
      name,
    });
  }

  return { shas: resolvedShas, fixtureCount: fixtureNames.length };
}

async function main() {
  const token = process.env.GH_TOKEN ?? '';
  const components = await readCurrentMainComponents();
  const shas = await resolveCurrentMainShas({ components, token });
  const lines = Object.entries(shas).map(([name, sha]) => `${name}_sha=${sha}`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
  const result = await auditCurrentMainContracts({ components, token, shas });
  console.log(
    `Verified ${result.fixtureCount} canonical fixture files across current provider, web, and iOS main commits:\n${lines.join('\n')}`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
