import { describe, expect, it } from 'vitest';
import { safeAuthReturnUrl } from '../authReturnUrl';

describe('authentication return destinations', () => {
  it.each([
    '/app',
    '/app/',
    '/app/journal',
    '/app/journal/01abc',
    '/app/settings/integrations',
    '/app/journal/01abc?draft=1#correction',
    '/app/study?viewAs=user-123',
  ])('preserves private path %s', (path) => {
    expect(safeAuthReturnUrl(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    '',
    [],
    5,
    'https://evil.example',
    '//evil.example/app',
    // eslint-disable-next-line no-script-url -- Rejected attack input, never navigated to.
    'javascript:alert(1)',
    '/login',
    '/tools',
    '/application',
    '/app/../login',
    '/app/%2e%2e/login',
    '/app/%2f%2fevil.example',
    '/app//evil',
    '/app\\evil',
    '/app?x=\\evil',
    '/app\n',
    '/app?x=\u0000',
    `/app?x=${'a'.repeat(2048)}`,
  ])('falls back to Journal for unsafe input %j', (value) => {
    expect(safeAuthReturnUrl(value)).toBe('/app/journal');
  });
});
