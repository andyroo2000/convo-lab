import fs from 'node:fs';

import { summarizeBackendRouteUsage } from '../src/migration/backendRouteUsageReport.js';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const inputPaths = process.argv.slice(2);
const input =
  inputPaths.length > 0
    ? inputPaths.map((path) => fs.readFileSync(path, 'utf8')).join('\n')
    : await readStdin();

const summary = summarizeBackendRouteUsage(input.split(/\r?\n/));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
