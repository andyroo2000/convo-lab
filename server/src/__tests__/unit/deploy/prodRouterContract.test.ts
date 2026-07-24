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
    expect(routerTemplate).toMatch(/location ~ \^\/api\/avatars\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/tools-audio\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location = \/api\/feature-flags \{/u);
    expect(routerTemplate).toMatch(/location = \/api\/convolab\/browser\/tools\/analytics \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/episodes\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).not.toContain('location ~ ^/api/convolab/episodes/[^/]+/audio/[^/]+$');
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/courses\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/scripts\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(
      /location ~ \^\/api\/convolab\/\(\?:dialogue\|audio\|images\)\(\?:\/\|\$\) \{/u
    );
    expect(routerTemplate).toMatch(
      /location ~ \^\/api\/\(dialogue\|audio\|images\)\(\/\.\*\)\?\$ \{/u
    );
    expect(routerTemplate).toContain(
      'rewrite ^/api/(dialogue|audio|images)(/.*)?$ /api/convolab/$1$2 break;'
    );
    expect(routerTemplate).toMatch(/location ~ \^\/api\/convolab\/admin\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toMatch(/location ~ \^\/api\/study\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).toContain(
      'location ~ "^/api/daily-audio-practice/[0-9a-fA-F-]{36}/tracks/[0-9a-fA-F-]{36}/audio$"'
    );
    expect(routerTemplate).toContain(
      'location ~ "^/api/study/media/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$"'
    );
    expect(routerTemplate).toMatch(/location ~ \^\/api\/daily-audio-practice\(\?:\/\|\$\) \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/convolab\/ \{/u);
    expect(routerTemplate).not.toMatch(/location \^~ \/api\/ \{/u);
  });

  it.each([
    ['location ^~ /api/convolab/auth/ {', 'location ~ ^/api/convolab/browser/auth(?:/|$)'],
    ['location ~ ^/api/convolab/browser/auth(?:/|$)', 'location ~ ^/api/auth/password(?:/|$)'],
    ['location ~ ^/api/auth/password(?:/|$)', 'location ~ ^/api/avatars(?:/|$)'],
    ['location ~ ^/api/avatars(?:/|$)', 'location ~ ^/api/tools-audio(?:/|$)'],
    ['location ~ ^/api/tools-audio(?:/|$)', 'location = /api/feature-flags {'],
    ['location = /api/feature-flags {', 'location = /api/convolab/browser/tools/analytics {'],
    [
      'location = /api/convolab/browser/tools/analytics {',
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
      'location ~ ^/api/(dialogue|audio|images)(/.*)?$',
    ],
    ['location ~ ^/api/(dialogue|audio|images)(/.*)?$', 'location ~ ^/api/convolab/admin(?:/|$)'],
    [
      'location ~ ^/api/convolab/admin(?:/|$)',
      '# Keep this regex synchronized with studyRouteContract.ts',
    ],
    [
      'location ~ "^/api/study/imports/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}/upload$"',
      'location ~ "^/api/study/media/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$"',
    ],
    [
      'location ~ "^/api/study/media/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$"',
      'location ~ ^/api/study(?:/|$)',
    ],
    [
      'location ~ ^/api/study(?:/|$)',
      'location ~ "^/api/daily-audio-practice/[0-9a-fA-F-]{36}/tracks/[0-9a-fA-F-]{36}/audio$"',
    ],
    [
      'location ~ "^/api/daily-audio-practice/[0-9a-fA-F-]{36}/tracks/[0-9a-fA-F-]{36}/audio$"',
      'location ~ ^/api/daily-audio-practice(?:/|$)',
    ],
    ['location ~ ^/api/daily-audio-practice(?:/|$)', 'location / {'],
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

  it('keeps legacy generation lookalike paths out of the compatibility rewrite', () => {
    const block = browserRouteBlock(
      'location ~ ^/api/(dialogue|audio|images)(/.*)?$',
      'location ~ ^/api/convolab/admin(?:/|$)'
    );

    expect(block).toContain('proxy_set_header X-XSRF-TOKEN $learning_os_xsrf_token;');
    expect(routerTemplate).not.toContain('location ^~ /api/dialogue');
    expect(routerTemplate).not.toContain('location ^~ /api/audio');
    expect(routerTemplate).not.toContain('location ^~ /api/images');
  });

  it('routes canonical Study traffic directly while preserving the authenticated legacy proxy', () => {
    const legacyUploadBlock = browserRouteBlock(
      '# Keep this regex synchronized with studyRouteContract.ts',
      'location ~ "^/api/study/imports/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}/upload$"'
    );
    const canonicalUploadBlock = browserRouteBlock(
      'location ~ "^/api/study/imports/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}/upload$"',
      'location ~ "^/api/study/media/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$"'
    );
    const canonicalMediaStreamBlock = browserRouteBlock(
      'location ~ "^/api/study/media/[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$"',
      'location ~ ^/api/study(?:/|$)'
    );
    const canonicalBlock = browserRouteBlock(
      'location ~ ^/api/study(?:/|$)',
      'location ~ "^/api/daily-audio-practice/[0-9a-fA-F-]{36}/tracks/[0-9a-fA-F-]{36}/audio$"'
    );
    const canonicalDailyAudioStreamBlock = browserRouteBlock(
      'location ~ "^/api/daily-audio-practice/[0-9a-fA-F-]{36}/tracks/[0-9a-fA-F-]{36}/audio$"',
      'location ~ ^/api/daily-audio-practice(?:/|$)'
    );
    const canonicalDailyAudioBlock = browserRouteBlock(
      'location ~ ^/api/daily-audio-practice(?:/|$)',
      'location / {'
    );

    expect(legacyUploadBlock).toContain('proxy_pass $convolab_upstream;');
    expect(legacyUploadBlock).not.toContain('proxy_pass $learning_os_upstream;');
    expect(legacyUploadBlock).toContain('client_max_body_size 2g;');
    expect(legacyUploadBlock).toContain('proxy_request_buffering off;');
    expect(legacyUploadBlock).toContain('proxy_send_timeout 1800s;');
    expect(canonicalUploadBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(canonicalUploadBlock).not.toContain('$convolab_upstream');
    expect(canonicalUploadBlock).toContain('client_max_body_size 2g;');
    expect(canonicalUploadBlock).toContain('proxy_request_buffering off;');
    expect(canonicalUploadBlock).toContain('proxy_send_timeout 1800s;');
    expect(canonicalMediaStreamBlock).toContain('proxy_pass $learning_os_upstream;');
    expect(canonicalMediaStreamBlock).not.toContain('$convolab_upstream');
    expect(canonicalMediaStreamBlock).toContain(
      `add_header Content-Security-Policy "sandbox; default-src 'none'" always;`
    );
    expect(canonicalMediaStreamBlock).toContain(
      'add_header Cross-Origin-Resource-Policy "same-origin" always;'
    );
    expect(canonicalBlock).not.toContain('rewrite ');
    expect(canonicalDailyAudioStreamBlock).toContain(
      `add_header Content-Security-Policy "sandbox; default-src 'none'" always;`
    );
    expect(canonicalDailyAudioStreamBlock).toContain(
      'add_header Cross-Origin-Resource-Policy "same-origin" always;'
    );
    expect(canonicalDailyAudioBlock).not.toContain('rewrite ');
    expect(routerTemplate).not.toContain(
      'location ~ ^/api/learning-os/study/daily-audio-practice(?:/|$)'
    );
    expect(routerTemplate).not.toContain('location ~ ^/api/learning-os/study(?:/|$)');
    expect(routerTemplate).not.toContain('location ^~ /api/study');
    expect(routerTemplate).not.toContain('location ^~ /api/learning-os/study');
  });
});
