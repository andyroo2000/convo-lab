import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, '../../client/public/japanese-input/v1');
const digest = 'd49b370cd0fc780395e8fa29c71121fab0896a2470d15a94284a050192329e82';
const prefix = '/japanese-input/v1';

async function binaries(directory) {
  const archive =
    process.env.JOURNAL_KEYBOARD_ARCHIVE ?? join(directory, 'journal-keyboard-v1.tar.gz');
  if (!process.env.JOURNAL_KEYBOARD_ARCHIVE)
    execFileSync('gh', [
      'release',
      'download',
      'journal-keyboard-runtime-v1',
      '--repo',
      'andyroo2000/convo-lab',
      '--pattern',
      'journal-keyboard-v1.tar.gz',
      '--dir',
      directory,
    ]);
  const hash = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  if (hash !== digest) throw Error('Journal keyboard asset checksum does not match');
  await mkdir(destination, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', destination]);
}

async function sources(source, target, only = null) {
  await mkdir(target, { recursive: true });
  for (const item of await readdir(source, { withFileTypes: true })) {
    if (!item.isFile() || !item.name.endsWith('.mjs')) continue;
    if (only && !only.includes(item.name)) continue;
    const text = await readFile(join(source, item.name), 'utf8');
    // Scope the playground's absolute module/worker/asset URLs to the versioned runtime.
    const scoped = text
      .replace(/(['"`])\/(browser|vendor|assets|gpu)\//g, `$1${prefix}/$2/`)
      .replace(/(['"])\/contract\.mjs/g, `$1${prefix}/contract.mjs`)
      .replace(/(['"])\/engine-transport\.mjs/g, `$1${prefix}/web/engine-transport.mjs`);
    await writeFile(join(target, item.name), scoped);
  }
}

async function stripDeclarations(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await stripDeclarations(path);
    else if (item.name.endsWith('.ts') || item.name.endsWith('.map')) await rm(path);
  }
}

async function assemble() {
  await stripDeclarations(join(destination, 'vendor'));
  await sources(join(root, 'web'), join(destination, 'web'));
  await sources(join(root, 'browser/web'), join(destination, 'browser'));
  await sources(join(root, 'journal'), join(destination, 'journal'));
  await rm(join(destination, 'gpu'), { recursive: true, force: true });
  await sources(join(root, 'performance/webgpu'), join(destination, 'gpu'), ['model.mjs']);
  await cp(join(root, 'contract.mjs'), join(destination, 'contract.mjs'));
  await cp(
    join(destination, 'browser/neural-model.mjs'),
    join(destination, 'browser/base-neural-model.mjs')
  );
  await cp(join(destination, 'gpu/model.mjs'), join(destination, 'browser/neural-model.mjs'));
  await writeFile(
    join(destination, 'web/engine-transport.mjs'),
    "export { engineFetch } from '../journal/transport.mjs';\n"
  );
  const transport = join(destination, 'journal/transport.mjs');
  await writeFile(
    transport,
    (await readFile(transport, 'utf8')).replace(
      '../browser/web/runtime.mjs',
      '../browser/runtime.mjs'
    )
  );
  await writeFile(
    join(destination, 'gpu/config.mjs'),
    `export const gpu = Boolean(navigator.gpu);\nexport const incremental = false, batchTokens = 512, sequenceCapacity = 16, sharePrompt = gpu, profiling = false;\n`
  );
  // Build helpers and isolated playground entry points are not shipped to users.
  for (const path of [
    'journal/package.mjs',
    'web/app.mjs',
    'browser/transport.mjs',
    'gpu/benchmark.mjs',
    'gpu/sweep.mjs',
  ])
    await rm(join(destination, path), { force: true });
}

const temporary = await mkdtemp(join(tmpdir(), 'journal-keyboard-'));
try {
  await binaries(temporary);
  await assemble();
  console.log('Prepared verified Journal Japanese input assets.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
