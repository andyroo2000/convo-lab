#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROVIDER_REPOSITORY = 'andyroo2000/learning-os';
const PROVIDER_COMMIT = '6f557e9ff7819bfee6c12d6e845ac28056475bdb';
const PROVIDER_DIRECTORY = 'tests/Fixtures/Compatibility';
const destination = fileURLToPath(
  new URL('../client/src/test/fixtures/learning-os/Compatibility/', import.meta.url)
);
const mode = process.argv[2] ?? '--verify';

if (!['--verify', '--check', '--write'].includes(mode)) {
  throw new Error('Usage: sync-learning-os-contract-fixtures.mjs [--verify|--check|--write]');
}

const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const expectedDigest = (contents) => contents.toString('utf8').trim().split(/\s+/u)[0];
const rawUrl = (file) =>
  `https://raw.githubusercontent.com/${PROVIDER_REPOSITORY}/${PROVIDER_COMMIT}/${PROVIDER_DIRECTORY}/${file}`;

async function fetchProviderFile(file) {
  const response = await fetch(rawUrl(file));
  if (!response.ok) throw new Error(`Unable to fetch ${file}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function localFile(file) {
  return readFile(resolve(destination, file));
}

async function verifyManifest(files) {
  const manifestBytes = files.get('manifest-v1.json');
  const manifestHashBytes = files.get('manifest-v1.sha256');
  if (!manifestBytes || !manifestHashBytes) throw new Error('Manifest files are missing.');
  if (digest(manifestBytes) !== expectedDigest(manifestHashBytes)) {
    throw new Error('manifest-v1.json does not match manifest-v1.sha256.');
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  manifest.fixtures.forEach((entry) => {
    const fixtureName = basename(entry.path);
    const checksumName = basename(entry.checksumPath);
    const fixture = files.get(fixtureName);
    const checksum = files.get(checksumName);
    if (!fixture || !checksum) throw new Error(`Missing vendored files for ${entry.id}.`);
    if (digest(fixture) !== entry.sha256 || expectedDigest(checksum) !== entry.sha256) {
      throw new Error(`${entry.id} does not match its canonical checksum.`);
    }
  });
  return [
    'manifest-v1.json',
    'manifest-v1.sha256',
    ...manifest.fixtures.flatMap((entry) => [basename(entry.path), basename(entry.checksumPath)]),
  ];
}

const manifestFiles = new Map([
  ['manifest-v1.json', mode === '--verify' ? await localFile('manifest-v1.json') : await fetchProviderFile('manifest-v1.json')],
  ['manifest-v1.sha256', mode === '--verify' ? await localFile('manifest-v1.sha256') : await fetchProviderFile('manifest-v1.sha256')],
]);
const providerManifest = JSON.parse(manifestFiles.get('manifest-v1.json').toString('utf8'));
const names = [
  'manifest-v1.json',
  'manifest-v1.sha256',
  ...providerManifest.fixtures.flatMap((entry) => [basename(entry.path), basename(entry.checksumPath)]),
];
const files = new Map(manifestFiles);

for (const name of names.slice(2)) {
  files.set(name, mode === '--verify' ? await localFile(name) : await fetchProviderFile(name));
}
await verifyManifest(files);

if (mode === '--write') {
  await mkdir(destination, { recursive: true });
  await Promise.all([...files].map(([name, contents]) => writeFile(resolve(destination, name), contents)));
} else if (mode === '--check') {
  for (const [name, contents] of files) {
    const vendored = await localFile(name);
    if (!vendored.equals(contents)) throw new Error(`${name} differs from ${PROVIDER_COMMIT}.`);
  }
}

const completedAction = { '--verify': 'verified', '--check': 'checked', '--write': 'synced' }[mode];
console.log(
  `Learning OS compatibility fixtures ${completedAction} at ${PROVIDER_COMMIT} (${names.length} files).`
);
