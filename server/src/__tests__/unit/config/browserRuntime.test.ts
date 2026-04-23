import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEVELOPMENT_ALLOWED_BROWSER_ORIGINS,
  FIRST_PARTY_PRODUCTION_ORIGINS,
  buildClientAppUrl,
  getAllowedBrowserOrigins,
  getClientAppConfig,
  getCsrfSecretConfig,
  getReadonlyBrowserRuntimeState,
  validateProductionBrowserRuntimeConfig,
} from '../../../config/browserRuntime.js';
import { getAllowedApiOrigins } from '../../../middleware/csrf.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';

describe('browser runtime config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    resetBrowserRuntimeTestState();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetBrowserRuntimeTestState();
  });

  it('fails fast in production when CLIENT_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CLIENT_URL;
    process.env.JWT_SECRET = 'jwt-secret';

    expect(() => validateProductionBrowserRuntimeConfig()).toThrow(
      'CLIENT_URL must be configured as an absolute URL in production.'
    );
  });

  it('fails fast in production when CLIENT_URL is invalid', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'not-a-url';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(() => getClientAppConfig()).toThrow(
      'CLIENT_URL must be configured as an absolute URL in production.'
    );
  });

  it('fails fast in production when only the development CSRF fallback is available', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://convo-lab.com';
    delete process.env.CSRF_SECRET;
    delete process.env.COOKIE_SECRET;
    delete process.env.JWT_SECRET;

    expect(() => getCsrfSecretConfig()).toThrow(
      'CSRF_SECRET, COOKIE_SECRET, or JWT_SECRET must be configured in production.'
    );
  });

  it('uses development fallbacks with warnings outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CLIENT_URL;
    delete process.env.CSRF_SECRET;
    delete process.env.COOKIE_SECRET;
    delete process.env.JWT_SECRET;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(getClientAppConfig()).toEqual({
      clientUrl: 'http://localhost:5173',
      clientOrigin: 'http://localhost:5173',
    });
    expect(getCsrfSecretConfig()).toEqual({
      secret: 'development-csrf-secret',
      source: 'development-fallback',
    });
    expect(getAllowedBrowserOrigins()).toEqual(DEVELOPMENT_ALLOWED_BROWSER_ORIGINS);
    expect(buildClientAppUrl('/login')).toBe('http://localhost:5173/login');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('does not use raw secret values in the CSRF config cache key', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.CSRF_SECRET = 'top-secret-value';

    expect(getCsrfSecretConfig()).toEqual({
      secret: 'top-secret-value',
      source: 'CSRF_SECRET',
    });
    expect(getReadonlyBrowserRuntimeState().csrfSecretConfigCache?.cacheKey).not.toContain(
      'top-secret-value'
    );
    expect(getReadonlyBrowserRuntimeState().csrfSecretConfigCache?.cacheKey).toContain('csrf:set');
  });

  it('uses the configured production origin set for CORS and keeps it aligned with CSRF', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://app.example.com',
      ...FIRST_PARTY_PRODUCTION_ORIGINS,
    ]);
    expect(Array.from(getAllowedApiOrigins())).toEqual(getAllowedBrowserOrigins());
    expect(buildClientAppUrl('/app/library')).toBe('https://app.example.com/app/library');
  });

  it('normalizes CLIENT_URL values with a trailing slash', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com/';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getClientAppConfig()).toEqual({
      clientUrl: 'https://app.example.com',
      clientOrigin: 'https://app.example.com',
    });
  });

  it('normalizes app URLs that omit a leading slash', () => {
    process.env.NODE_ENV = 'development';

    expect(buildClientAppUrl('pricing')).toBe('http://localhost:5173/pricing');
  });

  it('rejects absolute URLs passed to buildClientAppUrl', () => {
    process.env.NODE_ENV = 'development';

    expect(() => buildClientAppUrl('https://evil.com/path')).toThrow(
      'buildClientAppUrl expects a path, not an absolute URL: https://evil.com/path'
    );
  });

  it('does not implicitly allow the staging frontend against production CLIENT_URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://convo-lab.com';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://convo-lab.com',
      'https://www.convo-lab.com',
    ]);
  });

  it('still allows the staging frontend when it is the configured production app origin', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://stage.convo-lab.com';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://stage.convo-lab.com',
      'https://convo-lab.com',
      'https://www.convo-lab.com',
    ]);
  });
});
