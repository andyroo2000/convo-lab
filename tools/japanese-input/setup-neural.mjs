import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const model = JSON.parse(await readFile(`${root}neural-model.json`, 'utf8'));
const directory = `${root}.engines/zenz-v3-small`;
const destination = `${directory}/${model.filename}`;
await mkdir(directory, { recursive: true });
let bytes = await readFile(destination).catch(() => null);
if (!bytes) {
  const response = await fetch(
    `https://huggingface.co/${model.repository}/resolve/${model.revision}/${model.filename}`
  );
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (
  bytes.length !== model.bytes ||
  createHash('sha256').update(bytes).digest('hex') !== model.sha256
)
  throw new Error('Neural model checksum mismatch.');
await writeFile(destination, bytes);
execFileSync(
  'swift',
  [
    'build',
    '-c',
    'release',
    '--traits',
    'Neural',
    '--scratch-path',
    `${root}.engines/neural-build`,
  ],
  { cwd: `${root}engine`, stdio: 'inherit' }
);
