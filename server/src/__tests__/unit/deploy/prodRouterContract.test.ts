import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routerTemplatePath = fileURLToPath(
  new URL('../../../../../deploy/prod-router.conf.template', import.meta.url)
);
const routerTemplate = readFileSync(routerTemplatePath, 'utf8');

const browserRouteBlock = (start: string, end: string): string =>
  routerTemplate.slice(routerTemplate.indexOf(start), routerTemplate.indexOf(end));

describe('production router contract', () => {
  it('permanently routes the canonical browser namespaces to Learning OS', () => {
    expect(routerTemplate).toContain('set $learning_os_upstream http://learning-os:8080;');
    expect(routerTemplate).not.toContain('DIRECT_');
    expect(routerTemplate).toMatch(/location = \/sanctum\/csrf-cookie \{/u);
    expect(routerTemplate).toMatch(/location \^~ \/api\/convolab\/auth\/ \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/browser\/auth\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/auth\/password\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/tools-audio\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/episodes\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/courses\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/scripts\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(
      /location ~ \^\/api\/convolab\/\(\?:dialogue\|audio\|images\)\(\?:\/\|\$\) \{/u
    );
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/admin\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/convolab\/ \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/ \{/u);
  });

  it.each([
    ['location ^~ /api/convolab/auth/ {', 'location ~ ^/api/convolab/browser/auth(?:/|$)'],
    ['location ~ ^/api/convolab/browser/auth(?:/|$)', 'location ~ ^/api/auth/password(?:/|$)'],
    ['location ~ ^/api/auth/password(?:/|$)', 'location ~ ^/api/tools-audio(?:/|$)'],
    [
      'location ~ ^/api/tools-audio(?:/|$)',
      'location ~ ^/api/convolab/episodes/[^/]+/audio/[^/]+$',
    ],
    [
      'location ~ ^/api/convolab/episodes/[^/]+/audio/[^/]+$',
      'location ~ ^/api/convolab/episodes(?:/|$)',
    ],
    ['location ~ ^/api/convolab/episodes(?:/|$)', 'location ~ ^/api/convolab/courses(?:/|$)'],
    ['location ~ ^/api/convolab/courses(?:/|$)', 'location ~ ^/api/convolab/scripts(?:/|$)'],
    [
      'location ~ ^/api/convolab/scripts(?:/|$)',
      'location ~ ^/api/convolab/(?:dialogue|audio|images)(?:/|$)',
    ],
    [
      'location ~ ^/api/convolab/(?:dialogue|audio|images)(?:/|$)',
      'location ~ ^/api/convolab/admin(?:/|$)',
    ],
    [
      'location ~ ^/api/convolab/admin(?:/|$)',
      '# Keep this regex synchronized with studyRouteContract.ts',
    ],
  ])('strips proxy credentials from %s', (start, end) => {
    const block = browserRouteBlock(start, end);

    expect(block).toContain('proxy_set_header Authorization "";');
    expect(block).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(block).toContain('proxy_pass $learning_os_upstream;');
    expect(block).not.toContain('return 404;');
    expect(block).not.toContain('$convolab_upstream');
  });

  it('keeps the SPA and remaining Express routes on the ConvoLab upstream', () => {
    expect(routerTemplate).toMatch(/location \/ \{[\s\S]*proxy_pass \$convolab_upstream;/u);
  });
});
