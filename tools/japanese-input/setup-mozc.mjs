import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const mozcRevision = 'a4541df29db443b49f81cf54665873b68fde9efa';
const root = fileURLToPath(new URL('.', import.meta.url));
const source = `${root}.engines/mozc`;
const bazelisk = `${root}.engines/bin/bazelisk`;
const bazeliskHash = '555d2ff912ccd336d0060bdb5251ef2f62629c6f8fbadb59005a45d5625793ec';
function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, stdio: 'inherit' });
}

async function installBazelisk() {
  const response = await fetch(
    'https://github.com/bazelbuild/bazelisk/releases/download/v1.30.0/bazelisk-darwin-arm64'
  );
  if (!response.ok) throw new Error(`Bazelisk download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== bazeliskHash)
    throw new Error('Bazelisk checksum mismatch.');
  await mkdir(`${root}.engines/bin`, { recursive: true });
  await writeFile(bazelisk, bytes);
  await chmod(bazelisk, 0o755);
}

if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw new Error('This experimental build recipe currently supports Apple Silicon macOS only.');
if (!existsSync(source)) {
  run('git', ['init', source]);
  run('git', ['remote', 'add', 'origin', 'https://github.com/google/mozc.git'], source);
  run('git', ['fetch', '--depth', '1', 'origin', mozcRevision], source);
  run('git', ['checkout', '--detach', 'FETCH_HEAD'], source);
}
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
if (actual !== mozcRevision) throw new Error('Mozc checkout differs from the pinned revision.');
await installBazelisk();
const target = `${source}/src/convolab_benchmark`;
await mkdir(target, { recursive: true });
for (const file of ['worker.cc', 'BUILD.bazel']) {
  await copyFile(`${root}mozc/${file}`, `${target}/${file}`);
}
run(
  bazelisk,
  [
    'build',
    '//convolab_benchmark:worker',
    '//data_manager/oss:mozc.data',
    '--config',
    'release_build',
    '--jobs=6',
  ],
  `${source}/src`
);
