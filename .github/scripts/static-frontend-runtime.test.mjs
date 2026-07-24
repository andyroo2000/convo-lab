import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import YAML from 'yaml';

import * as seoRuntime from '../../shared/seo.mjs';

const { INDEXABLE_ROUTE_CONFIG, LEGACY_REDIRECTS, NOINDEX_PREFIXES, escapeHtml } = seoRuntime;

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('static frontend workflow builds and smokes the dedicated image', async () => {
  const workflowSource = await readFile(
    path.join(repositoryRoot, '.github/workflows/frontend-runtime.yml'),
    'utf8'
  );
  const workflow = YAML.parse(workflowSource);
  const steps = workflow.jobs.smoke.steps;
  const commands = steps.map((step) => step.run).filter(Boolean).join('\n');

  assert.equal(workflow.jobs.smoke['timeout-minutes'], 15);
  assert.match(commands, /docker build --file Dockerfile\.frontend/u);
  assert.match(commands, /--publish 127\.0\.0\.1:3001:3001/u);
  assert.match(commands, /\.\/deploy\/smoke-static-frontend\.sh/u);
});

test('frontend image contains only the built client and nginx runtime', async () => {
  const dockerfile = await readFile(path.join(repositoryRoot, 'Dockerfile.frontend'), 'utf8');

  assert.match(dockerfile, /FROM nginx:1\.27-alpine AS production/u);
  assert.match(
    dockerfile,
    /RUN node scripts\/render-static-spa-entrypoints\.mjs \/app\/client\/dist/u
  );
  assert.match(dockerfile, /COPY deploy\/frontend-nginx\.conf/u);
  assert.doesNotMatch(dockerfile, /server\/src|prisma|DATABASE_URL|REDIS_HOST/u);
});

test('Docker build contexts exclude local dependencies, build output, and secrets', async () => {
  const dockerignore = await readFile(path.join(repositoryRoot, '.dockerignore'), 'utf8');
  const ignoredPatterns = new Set(
    dockerignore
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const pattern of [
    '.git',
    '**/node_modules',
    '**/dist',
    '**/coverage',
    '.env',
    '.env.*',
    '**/.env',
    '**/.env.*',
  ]) {
    assert.ok(ignoredPatterns.has(pattern), `Expected .dockerignore to contain ${pattern}`);
  }
});

test('nginx keeps backend paths out of the SPA fallback', async () => {
  const config = await readFile(path.join(repositoryRoot, 'deploy/frontend-nginx.conf'), 'utf8');

  assert.match(config, /location \^~ \/api\//u);
  assert.match(config, /return 404 '\{"error":\{"message":"Not found"\}\}'/u);
  assert.match(config, /location \^~ \/study-media\//u);
  assert.match(config, /location \^~ \/__spa\//u);
  assert.match(config, /internal;/u);
  assert.match(config, /try_files \$uri @not_found_spa;/u);
});

test('static frontend smoke requests have explicit network timeouts', async () => {
  const smoke = await readFile(path.join(repositoryRoot, 'deploy/smoke-static-frontend.sh'), 'utf8');

  assert.match(smoke, /--connect-timeout 5/u);
  assert.match(smoke, /--max-time 15/u);
});

test('shared SEO runtime exports stay aligned with their TypeScript declarations', async () => {
  const declarations = await readFile(path.join(repositoryRoot, 'shared/seo.d.mts'), 'utf8');
  const declaredRuntimeExports = [
    ...declarations.matchAll(/export (?:const|function) ([A-Za-z0-9_]+)/gu),
  ]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(Object.keys(seoRuntime).sort(), declaredRuntimeExports);
});

test('entrypoint renderer emits every shared route and redirect', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'convolab-static-entrypoints-'));

  try {
    await writeFile(
      path.join(tempDirectory, 'index.html'),
      '<html><head><title>ConvoLab</title><meta name="description" content="Original" /></head><body><div id="root"></div></body></html>'
    );
    await execFileAsync(
      process.execPath,
      [path.join(repositoryRoot, 'scripts/render-static-spa-entrypoints.mjs'), tempDirectory],
      { cwd: repositoryRoot }
    );

    for (const [route, metadata] of Object.entries(INDEXABLE_ROUTE_CONFIG)) {
      const documentPath =
        route === '/'
          ? path.join(tempDirectory, 'index.html')
          : path.join(tempDirectory, route.slice(1), 'index.html');
      const html = await readFile(documentPath, 'utf8');
      assert.match(html, new RegExp(`<title>${escapeHtml(metadata.title)}</title>`, 'u'));
      assert.match(html, /<meta name="robots" content="index,follow" \/>/u);
    }

    const privateHtml = await readFile(path.join(tempDirectory, '__spa/noindex.html'), 'utf8');
    assert.match(privateHtml, /<meta name="robots" content="noindex,nofollow" \/>/u);
    assert.doesNotMatch(privateHtml, /rel="canonical"/u);

    const notFoundHtml = await readFile(path.join(tempDirectory, '__spa/not-found.html'), 'utf8');
    assert.match(notFoundHtml, /<title>Page Not Found \| ConvoLab<\/title>/u);

    const routes = await readFile(
      path.join(tempDirectory, '__spa/generated-routes.conf'),
      'utf8'
    );
    for (const [source, destination] of Object.entries(LEGACY_REDIRECTS)) {
      assert.match(routes, new RegExp(`location = ${source} \\{ return 301 ${destination}; \\}`, 'u'));
    }
    const privatePrefixPattern = NOINDEX_PREFIXES.map((prefix) => prefix.slice(1)).join('|');
    assert.match(
      routes,
      new RegExp(`location ~ \\^/\\(\\?:${privatePrefixPattern}\\)\\(\\?:/\\|\\$\\) \\{`, 'u')
    );
    for (const route of Object.keys(INDEXABLE_ROUTE_CONFIG)) {
      assert.match(routes, new RegExp(`location = ${route === '/' ? '\\/' : route} \\{`, 'u'));
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
