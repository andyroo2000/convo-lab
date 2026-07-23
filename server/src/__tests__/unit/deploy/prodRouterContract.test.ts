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
    expect(routerTemplate).toContain(
      'set $direct_episode_api_enabled __DIRECT_EPISODE_API_ENABLED__;'
    );
    expect(routerTemplate).toContain(
      'set $direct_course_api_enabled __DIRECT_COURSE_API_ENABLED__;'
    );
    expect(routerTemplate).toContain(
      'set $direct_script_api_enabled __DIRECT_SCRIPT_API_ENABLED__;'
    );
    expect(routerTemplate).toContain('set $direct_admin_api_enabled __DIRECT_ADMIN_API_ENABLED__;');
    expect(routerTemplate).toContain(
      'set $direct_browser_api_flags "$direct_account_api_enabled$direct_episode_api_enabled$direct_course_api_enabled$direct_script_api_enabled$direct_admin_api_enabled";'
    );
    expect(routerTemplate).toMatch(/location = \/sanctum\/csrf-cookie \{/u);
    expect(routerTemplate).toMatch(/location \^~ \/api\/convolab\/auth\/ \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/episodes\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/courses\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/scripts\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/admin\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/convolab\/ \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/ \{/u);
  });

  it('strips proxy credentials from each direct browser route', () => {
    const authBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ^~ /api/convolab/auth/ {'),
      routerTemplate.indexOf('location ~ ^/api/convolab/episodes')
    );

    expect(authBlock).toContain('proxy_set_header Authorization "";');
    expect(authBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(authBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(authBlock).toContain('if ($direct_account_api_enabled = 0)');

    const episodeBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ~ ^/api/convolab/episodes(?:/|$)'),
      routerTemplate.indexOf('location ~ ^/api/convolab/courses(?:/|$)')
    );

    expect(episodeBlock).toContain('proxy_set_header Authorization "";');
    expect(episodeBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(episodeBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(episodeBlock).toContain('if ($direct_episode_api_enabled = 0)');
    expect(episodeBlock).toContain('return 404;');

    const courseBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ~ ^/api/convolab/courses(?:/|$)'),
      routerTemplate.indexOf('location ~ ^/api/convolab/scripts(?:/|$)')
    );

    expect(courseBlock).toContain('proxy_set_header Authorization "";');
    expect(courseBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(courseBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(courseBlock).toContain('if ($direct_course_api_enabled = 0)');
    expect(courseBlock).toContain('return 404;');

    const scriptBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ~ ^/api/convolab/scripts(?:/|$)'),
      routerTemplate.indexOf('location ~ ^/api/convolab/admin(?:/|$)')
    );

    expect(scriptBlock).toContain('proxy_set_header Authorization "";');
    expect(scriptBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(scriptBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(scriptBlock).toContain('if ($direct_script_api_enabled = 0)');
    expect(scriptBlock).toContain('return 404;');

    const adminBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ~ ^/api/convolab/admin(?:/|$)'),
      routerTemplate.indexOf('# Keep this regex synchronized with studyRouteContract.ts')
    );

    expect(adminBlock).toContain('proxy_set_header Authorization "";');
    expect(adminBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
    expect(adminBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(adminBlock).toContain('if ($direct_admin_api_enabled = 0)');
    expect(adminBlock).toContain('return 404;');
    expect(routerTemplate).toMatch(/location \/ \{[\s\S]*proxy_pass \$convolab_upstream;/u);
  });

  it('keeps episode audio on the legacy proxy until direct Episodes is enabled', () => {
    const audioBlock = routerTemplate.slice(
      routerTemplate.indexOf('location ~ ^/api/convolab/episodes/[^/]+/audio/[^/]+$'),
      routerTemplate.indexOf('location ~ ^/api/convolab/episodes(?:/|$)')
    );

    expect(audioBlock).toContain('set $episode_audio_upstream $convolab_upstream;');
    expect(audioBlock).toContain('if ($direct_episode_api_enabled = 1)');
    expect(audioBlock).toContain('set $episode_audio_upstream $learning_os_upstream;');
    expect(audioBlock).toContain('proxy_pass $episode_audio_upstream;');
    expect(audioBlock).toContain('proxy_set_header Authorization "";');
    expect(audioBlock).toContain('proxy_set_header X-Convo-Lab-User-Id "";');
  });

  it('exposes Learning OS CSRF bootstrap when either direct route is enabled', () => {
    const csrfBlock = routerTemplate.slice(
      routerTemplate.indexOf('location = /sanctum/csrf-cookie {'),
      routerTemplate.indexOf('location ^~ /api/convolab/auth/')
    );

    expect(csrfBlock).toContain('if ($direct_browser_api_flags = "00000")');
    expect(csrfBlock).toContain('proxy_pass $learning_os_upstream;');
  });
});
