import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { engineInfo } from './contract.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const engine = `${root}.engines/AzooKeyKanaKanjiConverter`;
function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, stdio: 'inherit' });
}
if (!existsSync(engine)) {
  run('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    `v${engineInfo.version}`,
    'https://github.com/azooKey/AzooKeyKanaKanjiConverter.git',
    engine,
  ]);
}
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: engine, encoding: 'utf8' }).trim();
if (actual !== engineInfo.revision)
  throw new Error('Engine revision differs from the pinned version.');
run('git', ['submodule', 'update', '--init', '--recursive', '--depth', '1'], engine);
run('swift', ['build', '-c', 'release'], `${root}engine`);
