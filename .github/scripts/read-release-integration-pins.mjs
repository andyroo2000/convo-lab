#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = ['provider', 'web', 'ios'];
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const BRANCH_PATTERN = /^integration\/compatibility-[0-9]+-[0-9]+$/u;
const FIXTURE_DIRECTORY_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u;

export async function readReleaseIntegrationPins(pinsFile, branch) {
  if (!BRANCH_PATTERN.test(branch)) {
    throw new Error('Integration branch must include numeric run and attempt identifiers.');
  }
  const pins = JSON.parse(await readFile(pinsFile, 'utf8'));
  if (pins.schemaVersion !== 1) throw new Error('Component pins must use schemaVersion 1.');

  const outputs = { branch };
  for (const name of COMPONENTS) {
    const component = pins.components?.[name];
    if (!component || !REPOSITORY_PATTERN.test(component.repository ?? '')) {
      throw new Error(`${name} must declare an owner/repository value.`);
    }
    if (!SHA_PATTERN.test(component.sha ?? '')) {
      throw new Error(`${name} must use a full immutable commit SHA.`);
    }
    const fixtureDirectory = component.fixtureDirectory;
    if (
      typeof fixtureDirectory !== 'string' ||
      !FIXTURE_DIRECTORY_PATTERN.test(fixtureDirectory) ||
      path.posix.isAbsolute(fixtureDirectory) ||
      fixtureDirectory.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error(`${name} must declare a safe repository-relative fixture directory.`);
    }
    outputs[`${name}_repository`] = component.repository;
    outputs[`${name}_sha`] = component.sha;
    outputs[`${name}_fixture_directory`] = fixtureDirectory;
  }
  return outputs;
}

export function githubOutputLines(outputs) {
  return `${Object.entries(outputs)
    .map(([name, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) || /[\r\n]/u.test(String(value))) {
        throw new Error('GitHub output names and values must be single-line safe.');
      }
      return `${name}=${value}`;
    })
    .join('\n')}\n`;
}

async function main() {
  const [pinsFile, branch] = process.argv.slice(2);
  if (!branch) {
    throw new Error('Usage: read-release-integration-pins.mjs <pins.json> <integration-branch>');
  }
  process.stdout.write(githubOutputLines(await readReleaseIntegrationPins(pinsFile, branch)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
