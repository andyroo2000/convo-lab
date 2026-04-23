import { browserRuntimeState } from './browserRuntimeState.js';

const CLIENT_URL_FALLBACK = 'http://localhost:5173';
const DEVELOPMENT_CSRF_SECRET = 'development-csrf-secret';

export const DEVELOPMENT_ALLOWED_BROWSER_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

export const FIRST_PARTY_PRODUCTION_ORIGINS = [
  'https://convo-lab.com',
  'https://www.convo-lab.com',
  'https://stage.convo-lab.com',
];

type ClientAppConfig = {
  clientUrl: string;
  clientOrigin: string;
};

type CsrfSecretSource = 'CSRF_SECRET' | 'COOKIE_SECRET' | 'JWT_SECRET' | 'development-fallback';

type CsrfSecretConfig = {
  secret: string;
  source: CsrfSecretSource;
};

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function toNormalizedAppUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function warnClientUrlFallback(cacheKey: string) {
  if (browserRuntimeState.warnedClientUrlCacheKeys.has(cacheKey)) {
    return;
  }

  console.warn(
    `[Config] CLIENT_URL is missing or invalid; falling back to ${CLIENT_URL_FALLBACK} for local development.`
  );
  browserRuntimeState.warnedClientUrlCacheKeys.add(cacheKey);
}

function warnCsrfSecretFallback(cacheKey: string) {
  if (browserRuntimeState.warnedCsrfSecretCacheKeys.has(cacheKey)) {
    return;
  }

  console.warn(
    '[Config] CSRF_SECRET, COOKIE_SECRET, and JWT_SECRET are unset; using the development CSRF secret.'
  );
  browserRuntimeState.warnedCsrfSecretCacheKeys.add(cacheKey);
}

export function getClientAppConfig(): ClientAppConfig {
  const cacheKey = `${process.env.NODE_ENV ?? ''}:${process.env.CLIENT_URL ?? ''}`;
  if (browserRuntimeState.clientAppConfigCache?.cacheKey === cacheKey) {
    return browserRuntimeState.clientAppConfigCache.config;
  }

  const normalizedClientUrl = toNormalizedAppUrl(process.env.CLIENT_URL);
  if (!normalizedClientUrl) {
    if (isProductionEnvironment()) {
      throw new Error('CLIENT_URL must be configured as an absolute URL in production.');
    }

    warnClientUrlFallback(cacheKey);
  }

  const clientUrl = normalizedClientUrl ?? CLIENT_URL_FALLBACK;
  const config = {
    clientUrl,
    clientOrigin: new URL(clientUrl).origin,
  };

  browserRuntimeState.clientAppConfigCache = {
    cacheKey,
    config,
  };

  return config;
}

export function getClientAppUrl(): string {
  return getClientAppConfig().clientUrl;
}

export function getClientOrigin(): string {
  return getClientAppConfig().clientOrigin;
}

export function buildClientAppUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getClientAppUrl()}${normalizedPath}`;
}

export function getAllowedBrowserOrigins(): string[] {
  if (isProductionEnvironment()) {
    return [...new Set([getClientOrigin(), ...FIRST_PARTY_PRODUCTION_ORIGINS])];
  }

  return DEVELOPMENT_ALLOWED_BROWSER_ORIGINS;
}

export function getApiCorsOriginConfig(): string[] {
  return getAllowedBrowserOrigins();
}

export function getCsrfSecretConfig(): CsrfSecretConfig {
  const cacheKey = [
    process.env.NODE_ENV ?? '',
    `csrf:${process.env.CSRF_SECRET ? 'set' : 'unset'}`,
    `cookie:${process.env.COOKIE_SECRET ? 'set' : 'unset'}`,
    `jwt:${process.env.JWT_SECRET ? 'set' : 'unset'}`,
  ].join(':');

  if (browserRuntimeState.csrfSecretConfigCache?.cacheKey === cacheKey) {
    return browserRuntimeState.csrfSecretConfigCache.config;
  }

  const candidates: Array<{ value: string | undefined; source: CsrfSecretSource }> = [
    { value: process.env.CSRF_SECRET, source: 'CSRF_SECRET' },
    { value: process.env.COOKIE_SECRET, source: 'COOKIE_SECRET' },
    { value: process.env.JWT_SECRET, source: 'JWT_SECRET' },
  ];

  const configuredSecret = candidates.find(
    (candidate) => typeof candidate.value === 'string' && candidate.value.length > 0
  );

  if (!configuredSecret) {
    if (isProductionEnvironment()) {
      throw new Error(
        'CSRF_SECRET, COOKIE_SECRET, or JWT_SECRET must be configured in production.'
      );
    }

    warnCsrfSecretFallback(cacheKey);
  }

  const config = configuredSecret
    ? {
        secret: configuredSecret.value as string,
        source: configuredSecret.source,
      }
    : {
        secret: DEVELOPMENT_CSRF_SECRET,
        source: 'development-fallback' as const,
      };

  browserRuntimeState.csrfSecretConfigCache = {
    cacheKey,
    config,
  };

  return config;
}

export function getCsrfSecret(): string {
  return getCsrfSecretConfig().secret;
}

export function validateProductionBrowserRuntimeConfig() {
  if (!isProductionEnvironment()) {
    return;
  }

  getClientAppConfig();
  getCsrfSecretConfig();
}
