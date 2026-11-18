import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const roots = new Map([
  ['/browser/', 'browser/web'],
  ['/vendor/wllama/', process.env.WLLAMA_DIRECTORY ?? 'node_modules/@wllama/wllama/esm'],
  ['/vendor/wasi/', 'node_modules/@bjorn3/browser_wasi_shim/dist'],
  ['/assets/', '.engines/browser-assets'],
]);
const types = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.webp': 'image/webp',
};
const aliases = new Map([
  ['/contract.mjs', 'contract.mjs'],
  ['/engine-transport.mjs', 'browser/web/transport.mjs'],
  ['/wanakana.js', 'node_modules/wanakana/esm/index.js'],
  ['/tutor.webp', '../../client/public/images/tutor-hana.webp'],
  ['/', 'web/index.html'],
  ...(Boolean(process.env.NEURAL_BATCH)
    ? [
        [
          '/browser/neural-model.mjs',
          process.env.NEURAL_BATCH === 'prefix'
            ? 'performance/batch/prefix-model.mjs'
            : 'performance/batch/model.mjs',
        ],
        ['/browser/base-neural-model.mjs', 'browser/web/neural-model.mjs'],
        ['/browser/batched-neural-model.mjs', 'performance/batch/model.mjs'],
      ]
    : []),
]);
function asset(path) {
  if (aliases.has(path)) return resolve(root, aliases.get(path));
  for (const [prefix, directory] of roots) {
    if (!path.startsWith(prefix)) continue;
    const base = resolve(root, directory),
      file = resolve(base, path.slice(prefix.length));
    return file.startsWith(base + sep) ? file : null;
  }
  if (/^\/[\w.-]+$/.test(path)) return resolve(root, 'web', path.slice(1));
  return null;
}
export function createBrowserServer() {
  return createServer(async (request, response) => {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const file = asset(new URL(request.url, 'http://localhost').pathname);
    try {
      if (!['GET', 'HEAD'].includes(request.method) || !file) throw Error('Not found');
      if (!(await stat(file)).isFile()) throw Error('Not found');
      response.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Content-Length': (await stat(file)).size,
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createBrowserServer().listen(Number(process.env.PORT ?? 5189), '127.0.0.1', () =>
    console.log(`Browser playground: http://127.0.0.1:${process.env.PORT ?? 5189}`)
  );
}
