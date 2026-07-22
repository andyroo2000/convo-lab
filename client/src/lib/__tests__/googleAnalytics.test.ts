import { describe, expect, it } from 'vitest';

import { buildAnalyticsPageLocation, sanitizeAnalyticsPagePath } from '../googleAnalytics';

describe('sanitizeAnalyticsPagePath', () => {
  it.each([
    ['/reset-password/legacy-secret', '', '', '/reset-password'],
    ['/reset-password', '?token=broker-secret&email=learner%40example.com', '', '/reset-password'],
  ])('removes password reset credentials from analytics URLs', (pathname, search, hash, result) => {
    expect(sanitizeAnalyticsPagePath(pathname, search, hash)).toBe(result);
  });

  it('preserves ordinary route query and fragment dimensions', () => {
    expect(sanitizeAnalyticsPagePath('/app/library', '?page=2', '#recent')).toBe(
      '/app/library?page=2#recent'
    );
  });

  it('keeps network-path references on the application origin', () => {
    expect(buildAnalyticsPageLocation('//evil.example.com/x', 'https://convo-lab.com')).toBe(
      'https://convo-lab.com//evil.example.com/x'
    );
  });
});
