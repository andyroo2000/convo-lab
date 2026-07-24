import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEVELOPMENT_ALLOWED_BROWSER_ORIGINS,
  FIRST_PARTY_PRODUCTION_ORIGINS,
  buildClientAppUrl,
  getAllowedBrowserOrigins,
  getClientAppConfig,
  validateProductionBrowserRuntimeConfig,
} from '../../../config/browserRuntime.js';
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

    expect(() => validateProductionBrowserRuntimeConfig()).toThrow(
      'CLIENT_URL must be configured as an absolute URL in production.'
    );
  });

  it('fails fast in production when CLIENT_URL is invalid', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'not-a-url';

    expect(() => getClientAppConfig()).toThrow(
      'CLIENT_URL must be configured as an absolute URL in production.'
    );
  });

  it('uses the client URL development fallback with a warning outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CLIENT_URL;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(getClientAppConfig()).toEqual({
      clientUrl: 'http://localhost:5173',
      clientOrigin: 'http://localhost:5173',
    });
    expect(getAllowedBrowserOrigins()).toEqual(DEVELOPMENT_ALLOWED_BROWSER_ORIGINS);
    expect(buildClientAppUrl('/login')).toBe('http://localhost:5173/login');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the configured production origin set for CORS', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://app.example.com',
      ...FIRST_PARTY_PRODUCTION_ORIGINS,
    ]);
    expect(buildClientAppUrl('/app/library')).toBe('https://app.example.com/app/library');
  });

  it('normalizes CLIENT_URL values with a trailing slash', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://app.example.com/';

    expect(getClientAppConfig()).toEqual({
      clientUrl: 'https://app.example.com',
      clientOrigin: 'https://app.example.com',
    });
  });

  it('normalizes app URLs that omit a leading slash', () => {
    process.env.NODE_ENV = 'development';

    expect(buildClientAppUrl('app/settings/profile')).toBe(
      'http://localhost:5173/app/settings/profile'
    );
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

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://convo-lab.com',
      'https://www.convo-lab.com',
    ]);
  });

  it('still allows the staging frontend when it is the configured production app origin', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://stage.convo-lab.com';

    expect(getAllowedBrowserOrigins()).toEqual([
      'https://stage.convo-lab.com',
      'https://convo-lab.com',
      'https://www.convo-lab.com',
    ]);
  });
});
