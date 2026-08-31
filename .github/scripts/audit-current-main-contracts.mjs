#!/usr/bin/env node

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

export const CURRENT_MAIN_COMPONENTS = {
  provider: {
    repository: 'andyroo2000/learning-os',
    fixtureDirectory: 'tests/Fixtures/Compatibility',
  },
  web: {
    repository: 'andyroo2000/convo-lab',
    fixtureDirectory: 'client/src/test/fixtures/learning-os/Compatibility',
  },
  ios: {
    repository: 'andyroo2000/convo-lab-ios',
    fixtureDirectory: 'ConvoLabTests/Fixtures/Compatibility',
  },
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expectedDigest = (bytes) => bytes.toString('utf8').trim().split(/\s+/u)[0];

function fixtureBasename(value) {
  const name = path.posix.basename(value);
  if (!name || name === '.' || name === '..') throw new Error(`Invalid fixture path: ${value}`);
  return name;
}

async function responseBytes(response, description) {
  if (!response.ok) throw new Error(`Unable to fetch ${description}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveMainSha(fetchImpl, repository, token) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error(`Invalid repository: ${repository}`);
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const repositoryResponse = await fetchImpl(`https://api.github.com/repos/${repository}`, {
    headers,
  });
  if (!repositoryResponse.ok) {
    throw new Error(`Unable to resolve ${repository}: HTTP ${repositoryResponse.status}`);
  }
  const metadata = await repositoryResponse.json();
  if (typeof metadata.default_branch !== 'string' || metadata.default_branch === '') {
    throw new Error(`${repository} did not return a default branch.`);
  }
  const commitResponse = await fetchImpl(
    `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(metadata.default_branch)}`,
    { headers }
  );
  if (!commitResponse.ok) {
    throw new Error(`Unable to resolve ${repository} default branch: HTTP ${commitResponse.status}`);
  }
  const commit = await commitResponse.json();
  if (!SHA_PATTERN.test(commit.sha ?? '')) {
    throw new Error(`${repository} default branch did not resolve to a full commit SHA.`);
  }
  return commit.sha;
}

function rawUrl(component, sha, name) {
  return `https://raw.githubusercontent.com/${component.repository}/${sha}/${component.fixtureDirectory}/${name}`;
}

async function fetchFixture(fetchImpl, component, sha, name) {
  return responseBytes(await fetchImpl(rawUrl(component, sha, name)), `${component.repository}/${name}`);
}

export async function auditCurrentMainContracts({
  components = CURRENT_MAIN_COMPONENTS,
  fetchImpl = fetch,
  token = '',
} = {}) {
  const entries = Object.entries(components);
  if (entries.map(([name]) => name).join(',') !== 'provider,web,ios') {
    throw new Error('Current-main audit requires provider, web, and iOS components.');
  }

  const shas = Object.fromEntries(
    await Promise.all(
      entries.map(async ([name, component]) => [
        name,
        await resolveMainSha(fetchImpl, component.repository, token),
      ])
    )
  );
  const provider = components.provider;
  const manifestBytes = await fetchFixture(
    fetchImpl,
    provider,
    shas.provider,
    'manifest-v1.json'
  );
  const manifestChecksumBytes = await fetchFixture(
    fetchImpl,
    provider,
    shas.provider,
    'manifest-v1.sha256'
  );
  if (sha256(manifestBytes) !== expectedDigest(manifestChecksumBytes)) {
    throw new Error('Provider current-main manifest checksum does not match its bytes.');
  }

  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const fixtureNames = [
    'manifest-v1.json',
    'manifest-v1.sha256',
    ...(manifest.fixtures ?? []).flatMap((fixture) => [
      fixtureBasename(fixture.path),
      fixtureBasename(fixture.checksumPath),
    ]),
  ];
  const providerFiles = new Map([
    ['manifest-v1.json', manifestBytes],
    ['manifest-v1.sha256', manifestChecksumBytes],
  ]);

  for (const fixture of manifest.fixtures ?? []) {
    const payloadName = fixtureBasename(fixture.path);
    const checksumName = fixtureBasename(fixture.checksumPath);
    const payload = await fetchFixture(fetchImpl, provider, shas.provider, payloadName);
    const checksum = await fetchFixture(fetchImpl, provider, shas.provider, checksumName);
    if (sha256(payload) !== fixture.sha256 || expectedDigest(checksum) !== fixture.sha256) {
      throw new Error(`Provider current-main checksum mismatch for ${fixture.id}.`);
    }
    providerFiles.set(payloadName, payload);
    providerFiles.set(checksumName, checksum);
  }

  for (const name of ['web', 'ios']) {
    const component = components[name];
    for (const fixtureName of fixtureNames) {
      const consumerBytes = await fetchFixture(fetchImpl, component, shas[name], fixtureName);
      if (!providerFiles.get(fixtureName)?.equals(consumerBytes)) {
        throw new Error(`${name} current-main fixture differs from provider: ${fixtureName}`);
      }
    }
  }

  return { shas, fixtureCount: fixtureNames.length };
}

async function main() {
  const result = await auditCurrentMainContracts({ token: process.env.GH_TOKEN ?? '' });
  const lines = Object.entries(result.shas).map(([name, sha]) => `${name}_sha=${sha}`);
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
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
