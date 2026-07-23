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
    expect(routerTemplate).toContain(
      'set $direct_account_api_enabled __DIRECT_ACCOUNT_API_ENABLED__;'
    );
    expect(routerTemplate).toMatch(/location = \/sanctum\/csrf-cookie \{/u);
    expect(routerTemplate).toMatch(/location \^~ \/api\/convolab\/ \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/ \{/u);
  });

  it('closes the direct route behind the rollout flag and strips service credentials', () => {
    const directBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ^~ /api/convolab/ {'),
      routerTemplate.indexOf('# Keep this regex synchronized with studyRouteContract.ts')
    );

    expect(directBlock).toContain('proxy_set_header Authorization "";');
    expect(directBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(directBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(directBlock).toContain('if ($direct_account_api_enabled = 0)');
    expect(directBlock).toContain('return 404;');
  });
});
