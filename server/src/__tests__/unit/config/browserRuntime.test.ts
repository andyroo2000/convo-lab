import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEVELOPMENT_ALLOWED_BROWSER_ORIGINS,
  FIRST_PARTY_PRODUCTION_ORIGINS,
  buildClientAppUrl,
  getAllowedBrowserOrigins,
  getApiCorsOriginConfig,
  getClientAppConfig,
  getCsrfSecretConfig,
  validateProductionBrowserRuntimeConfig,
} from '../../../config/browserRuntime.js';
import { browserRuntimeState } from '../../../config/browserRuntimeState.js';
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
    expect(getApiCorsOriginConfig()).toEqual(DEVELOPMENT_ALLOWED_BROWSER_ORIGINS);
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
    expect(browserRuntimeState.csrfSecretConfigCache?.cacheKey).not.toContain('top-secret-value');
    expect(browserRuntimeState.csrfSecretConfigCache?.cacheKey).toContain('csrf:set');
  });

  it('uses the configured production origin set for CORS and keeps it aligned with CSRF', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com';
    process.env.JWT_SECRET = 'jwt-secret';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://app.example.com',
      ...FIRST_PARTY_PRODUCTION_ORIGINS,
    ]);
    expect(getApiCorsOriginConfig()).toEqual(getAllowedBrowserOrigins());
    expect(Array.from(getAllowedApiOrigins())).toEqual(getAllowedBrowserOrigins());
    expect(buildClientAppUrl('/app/library')).toBe('https://app.example.com/app/library');
  });
});
