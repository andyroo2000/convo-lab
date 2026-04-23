import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEVELOPMENT_ALLOWED_BROWSER_ORIGINS,
  buildClientAppUrl,
  getApiCorsOriginConfig,
  getClientAppConfig,
  getCsrfSecretConfig,
  resetBrowserRuntimeConfigForTests,
  validateProductionBrowserRuntimeConfig,
} from '../../../config/browserRuntime.js';

describe('browser runtime config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    resetBrowserRuntimeConfigForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetBrowserRuntimeConfigForTests();
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
    expect(getApiCorsOriginConfig()).toEqual(DEVELOPMENT_ALLOWED_BROWSER_ORIGINS);
    expect(buildClientAppUrl('/login')).toBe('http://localhost:5173/login');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('uses the configured production origin for CORS', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://convo-lab.com';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getApiCorsOriginConfig()).toBe('https://convo-lab.com');
    expect(buildClientAppUrl('/app/library')).toBe('https://convo-lab.com/app/library');
  });
});
