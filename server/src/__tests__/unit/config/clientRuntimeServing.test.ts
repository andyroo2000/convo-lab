import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(currentFile), '../../../../..');
const serverEntry = fs.readFileSync(path.join(repositoryRoot, 'server/src/index.ts'), 'utf8');

describe('client document serving', () => {
  it('returns JSON 404s for retired API routes before the production SPA fallback', () => {
    const apiFallbackStart = serverEntry.indexOf("app.use('/api', (_req, res) => {");
    const productionServingStart = serverEntry.indexOf(
      "if (process.env.NODE_ENV === 'production') {"
    );
    const apiFallback = serverEntry.slice(apiFallbackStart, productionServingStart);

    expect(apiFallbackStart).toBeGreaterThanOrEqual(0);
    expect(productionServingStart).toBeGreaterThan(apiFallbackStart);
    expect(apiFallback).toContain("res.status(404).json({ error: { message: 'Not found' } })");
  });

  it('routes every index document through the SEO-aware SPA fallback', () => {
    const indexRedirectStart = serverEntry.indexOf("app.get('/index.html', (_req, res) => {");
    const staticFilesStart = serverEntry.indexOf('express.static(clientPath, {');
    const spaFallbackStart = serverEntry.indexOf("app.get('*', (req, res) => {");
    const staticFiles = serverEntry.slice(staticFilesStart, spaFallbackStart);
    const spaFallback = serverEntry.slice(spaFallbackStart);

    expect(indexRedirectStart).toBeGreaterThanOrEqual(0);
    expect(staticFilesStart).toBeGreaterThan(indexRedirectStart);
    expect(spaFallbackStart).toBeGreaterThan(staticFilesStart);
    expect(staticFiles).toContain('index: false,');
    expect(spaFallback).toContain('injectSeoMeta(readIndexHtml(), seoConfig)');
    expect(serverEntry).not.toContain('__CONVOLAB_RUNTIME_CONFIG__');
  });
});
