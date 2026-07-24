import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  INDEXABLE_ROUTE_CONFIG,
  LEGACY_REDIRECTS,
  NOINDEX_PREFIXES,
  getSeoConfigForPath,
  injectSeoMeta,
} from '../shared/seo.mjs';

const [outputDirectory] = process.argv.slice(2);

if (!outputDirectory) {
  throw new Error('Usage: node scripts/render-static-spa-entrypoints.mjs <client-dist>');
}

const indexPath = path.join(outputDirectory, 'index.html');
const baseHtml = await readFile(indexPath, 'utf8');

for (const route of Object.keys(INDEXABLE_ROUTE_CONFIG)) {
  const destination =
    route === '/' ? indexPath : path.join(outputDirectory, route.slice(1), 'index.html');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, injectSeoMeta(baseHtml, getSeoConfigForPath(route)));
}

const spaDirectory = path.join(outputDirectory, '__spa');
await mkdir(spaDirectory, { recursive: true });
await writeFile(
  path.join(spaDirectory, 'noindex.html'),
  injectSeoMeta(baseHtml, getSeoConfigForPath('/app'))
);
await writeFile(
  path.join(spaDirectory, 'not-found.html'),
  injectSeoMeta(baseHtml, getSeoConfigForPath('/not-found'))
);

const redirectConfig = Object.entries(LEGACY_REDIRECTS)
  .map(([source, target]) => `location = ${source} { return 301 ${target}; }`)
  .join('\n');

const noindexPrefixPattern = NOINDEX_PREFIXES.map((prefix) =>
  prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|');
const noindexRouteConfig = `location ~ ^/(?:${noindexPrefixPattern})(?:/|$) {
  try_files /__spa/noindex.html =404;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires "0";
}`;

const indexableRouteConfig = Object.keys(INDEXABLE_ROUTE_CONFIG)
  .map((route) => {
    const documentPath = route === '/' ? '/index.html' : `${route}/index.html`;
    const trailingSlashRedirect =
      route === '/' ? '' : `\nlocation = ${route}/ { return 308 ${route}; }`;

    return `location = ${route} {
  try_files ${documentPath} =404;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires "0";
}${trailingSlashRedirect}`;
  })
  .join('\n\n');

await writeFile(
  path.join(outputDirectory, '__spa', 'generated-routes.conf'),
  `${redirectConfig}\n\n${noindexRouteConfig}\n\n${indexableRouteConfig}\n`
);
