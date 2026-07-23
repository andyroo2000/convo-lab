import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routerTemplatePath = fileURLToPath(
  new URL('../../../../../deploy/prod-router.conf.template', import.meta.url)
);
const routerTemplate = readFileSync(routerTemplatePath, 'utf8');

describe('production router contract', () => {
  it('routes only the explicit browser compatibility namespace directly to Learning OS', () => {
    expect(routerTemplate).toContain('set $learning_os_upstream http://learning-os:8080;');
    expect(routerTemplate).toMatch(/location = \/sanctum\/csrf-cookie \{/u);
    expect(routerTemplate).toMatch(/location \^~ \/api\/convolab\/ \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/ \{/u);
  });

  it('strips service credentials from the public direct route', () => {
    const directBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ^~ /api/convolab/ {'),
      routerTemplate.indexOf('# Keep this regex synchronized with studyRouteContract.ts')
    );

    expect(directBlock).toContain('proxy_set_header Authorization "";');
    expect(directBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(directBlock).toContain('proxy_pass $learning_os_upstream;');
  });
});
