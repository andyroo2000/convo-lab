#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/u;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function fixtureBasename(providerPath) {
  const name = path.posix.basename(providerPath);
  if (!name || name === '.' || name === '..') throw new Error(`Invalid fixture path: ${providerPath}`);
  return name;
}

export async function verifyReleaseIntegration({ pinsFile, providerDirectory, webDirectory, iosDirectory }) {
  const pins = await json(pinsFile);
  if (pins.schemaVersion !== 1) throw new Error('Component pins must use schemaVersion 1.');

  for (const name of ['provider', 'web', 'ios']) {
    const component = pins.components?.[name];
    if (!component || typeof component.repository !== 'string') {
      throw new Error(`Missing ${name} component repository.`);
    }
    if (!SHA_PATTERN.test(component.sha ?? '')) {
      throw new Error(`${name} component must be pinned to a full commit SHA.`);
    }
  }

  const manifestName = 'manifest-v1.json';
  const manifestChecksumName = 'manifest-v1.sha256';
  const manifestBytes = await readFile(path.join(providerDirectory, manifestName));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestChecksum = (await readFile(path.join(providerDirectory, manifestChecksumName), 'utf8'))
    .trim()
    .split(/\s+/u)[0];
  if (sha256(manifestBytes) !== manifestChecksum) {
    throw new Error('Provider manifest checksum does not match its bytes.');
  }

  const fixtureNames = [manifestName, manifestChecksumName];
  for (const fixture of manifest.fixtures ?? []) {
    const payloadName = fixtureBasename(fixture.path);
    const checksumName = fixtureBasename(fixture.checksumPath);
    const payloadBytes = await readFile(path.join(providerDirectory, payloadName));
    const checksum = (await readFile(path.join(providerDirectory, checksumName), 'utf8'))
      .trim()
      .split(/\s+/u)[0];
    if (sha256(payloadBytes) !== fixture.sha256 || checksum !== fixture.sha256) {
      throw new Error(`Provider checksum mismatch for ${fixture.id}.`);
    }
    fixtureNames.push(payloadName, checksumName);
  }

  for (const [consumer, directory] of [
    ['web', webDirectory],
    ['ios', iosDirectory],
  ]) {
    for (const name of fixtureNames) {
      const [providerBytes, consumerBytes] = await Promise.all([
        readFile(path.join(providerDirectory, name)),
        readFile(path.join(directory, name)),
      ]);
      if (!providerBytes.equals(consumerBytes)) {
        throw new Error(`${consumer} fixture differs from provider bytes: ${name}`);
      }
    }
  }

  return { fixtureCount: fixtureNames.length, pins };
}

async function main() {
  const [pinsFile, providerDirectory, webDirectory, iosDirectory] = process.argv.slice(2);
  if (!iosDirectory) {
    throw new Error(
      'Usage: verify-release-integration.mjs <pins.json> <provider-fixtures> <web-fixtures> <ios-fixtures>'
    );
  }
  const result = await verifyReleaseIntegration({
    pinsFile,
    providerDirectory,
    webDirectory,
    iosDirectory,
  });
  console.log(
    `Verified ${result.fixtureCount} canonical fixture files across provider, web, and iOS.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
