import { describe, expect, it } from 'vitest';

import {
  INDEXABLE_ROUTE_CONFIG,
  LEGACY_REDIRECTS,
  getSeoConfigForPath,
  injectSeoMeta,
  normalizePathname,
} from '../../../../../shared/seo.mjs';

const baseHtml =
  '<!doctype html><html><head><title>Original</title><meta name="description" content="Original" /></head><body></body></html>';

describe('shared client SEO configuration', () => {
  it.each(Object.entries(INDEXABLE_ROUTE_CONFIG))(
    'returns indexable metadata for %s and its trailing-slash variant',
    (route, expected) => {
      expect(getSeoConfigForPath(route)).toEqual(expected);
      expect(getSeoConfigForPath(route === '/' ? route : `${route}/`)).toEqual(expected);
      expect(expected.robots).toBe('index,follow');
      expect(expected.canonicalUrl).toMatch(/^https:\/\/convo-lab\.com\//u);
    }
  );

  it.each([
    '/app',
    '/app/study',
    '/login',
    '/claim-invite/token',
    '/verify-email/token',
    '/forgot-password',
    '/reset-password/token',
  ])('marks private application path %s as noindex', (route) => {
    expect(getSeoConfigForPath(route)).toEqual({
      title: 'ConvoLab',
      description: 'ConvoLab language learning application.',
      robots: 'noindex,nofollow',
    });
  });

  it('uses noindex not-found metadata for unknown public routes', () => {
    expect(getSeoConfigForPath('/unknown')).toEqual({
      title: 'Page Not Found | ConvoLab',
      description: 'The page you requested could not be found on ConvoLab.',
      robots: 'noindex,nofollow',
    });
  });

  it('normalizes only a final trailing slash', () => {
    expect(normalizePathname('/')).toBe('/');
    expect(normalizePathname('/tools/')).toBe('/tools');
    expect(normalizePathname('/tools//')).toBe('/tools/');
  });

  it('injects escaped metadata without giving private pages a canonical URL', () => {
    const html = injectSeoMeta(baseHtml, {
      title: 'A & <B>',
      description: 'A "quoted" description',
      robots: 'noindex,nofollow',
    });

    expect(html).toContain('<title>A &amp; &lt;B&gt;</title>');
    expect(html).toContain('content="A &quot;quoted&quot; description"');
    expect(html).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:url"');
  });

  it('keeps legacy redirects centralized with their canonical destinations', () => {
    expect(LEGACY_REDIRECTS).toEqual({
      '/tools/date': '/tools/japanese-date',
      '/tools/time': '/tools/japanese-time',
      '/tools/money': '/tools/japanese-money',
    });

    for (const destination of Object.values(LEGACY_REDIRECTS)) {
      expect(INDEXABLE_ROUTE_CONFIG).toHaveProperty(destination);
    }
  });
});
