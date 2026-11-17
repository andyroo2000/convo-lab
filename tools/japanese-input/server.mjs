import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { EngineClient } from './engine-client.mjs';
import { engineInfo, validateConversion, conversionResponse } from './contract.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const assets = new Map([
  ['/', ['web/index.html', 'text/html']],
  ['/app.mjs', ['web/app.mjs', 'text/javascript']],
  ['/editor.mjs', ['web/editor.mjs', 'text/javascript']],
  ['/candidates.mjs', ['web/candidates.mjs', 'text/javascript']],
  ['/style.css', ['web/style.css', 'text/css']],
  ['/wanakana.js', ['node_modules/wanakana/esm/index.js', 'text/javascript']],
  ['/tutor.webp', ['../../client/public/images/tutor-hana.webp', 'image/webp']],
]);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 4096) throw new Error('This phrase is too long.');
  }
  return JSON.parse(body);
}

function allowedRequest(request) {
  const host = request.headers.host ?? '';
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return false;
  const origin = request.headers.origin;
  return !origin || origin === `http://${host}`;
}

async function convertRequest(request, response, engine) {
  if (request.headers['content-type'] !== 'application/json') {
    json(response, 415, { error: 'Send JSON.' });
    return;
  }
  let reading;
  try {
    reading = validateConversion(await readBody(request));
  } catch (error) {
    json(response, 400, { error: error.message });
    return;
  }
  try {
    const result = await engine.convert(reading);
    json(response, 200, conversionResponse(reading, result));
  } catch (error) {
    json(response, 503, { error: error.message });
  }
}

async function route(request, response, engine) {
  if (!allowedRequest(request)) {
    json(response, 403, { error: 'Local playground only.' });
    return;
  }
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/v1/convert' && request.method === 'POST') {
    await convertRequest(request, response, engine);
    return;
  }
  if (path === '/api/v1/engine' && request.method === 'GET') {
    json(response, 200, engineInfo);
    return;
  }
  const asset = assets.get(path);
  if (request.method !== 'GET' || !asset) {
    json(response, 404, { error: 'Page not found.' });
    return;
  }
  const content = await readFile(resolve(root, asset[0]));
  response.writeHead(200, {
    'Content-Type': asset[1],
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(content);
}

export function createPlaygroundServer(engine = new EngineClient()) {
  const server = createServer((request, response) => {
    route(request, response, engine).catch(() =>
      json(response, 500, { error: 'Could not load the playground.' })
    );
  });
  server.on('close', () => engine.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPlaygroundServer();
  const port = Number(process.env.PORT ?? 5188);
  server.listen(port, '127.0.0.1', () =>
    console.log(`Typing playground: http://127.0.0.1:${port}`)
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
