import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(currentFile), '../../../../..');
const serverEntry = fs.readFileSync(path.join(repositoryRoot, 'server/src/index.ts'), 'utf8');

describe('client runtime config serving', () => {
  it('routes every index document through the runtime config injector', () => {
    const indexRedirectStart = serverEntry.indexOf(
      "app.get('/index.html', redirectClientIndexDocument);"
    );
    const staticFilesStart = serverEntry.indexOf('express.static(clientPath, {');
    const spaFallbackStart = serverEntry.indexOf("app.get('*', (req, res) => {");
    const staticFiles = serverEntry.slice(staticFilesStart, spaFallbackStart);
    const spaFallback = serverEntry.slice(spaFallbackStart);

    expect(indexRedirectStart).toBeGreaterThanOrEqual(0);
    expect(staticFilesStart).toBeGreaterThan(indexRedirectStart);
    expect(spaFallbackStart).toBeGreaterThan(staticFilesStart);
    expect(staticFiles).toContain('index: false,');
    expect(spaFallback).toContain(
      'injectClientRuntimeConfig(injectSeoMeta(readIndexHtml(), seoConfig))'
    );
  });
});
