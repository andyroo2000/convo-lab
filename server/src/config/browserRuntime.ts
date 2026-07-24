import { browserRuntimeState } from './browserRuntimeState.js';

const CLIENT_URL_FALLBACK = 'http://localhost:5173';

export const DEVELOPMENT_ALLOWED_BROWSER_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

export const FIRST_PARTY_PRODUCTION_ORIGINS = [
  'https://convo-lab.com',
  'https://www.convo-lab.com',
];

type ClientAppConfig = {
  clientUrl: string;
  clientOrigin: string;
};

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getBrowserOriginsCacheKey(): string {
  return `${process.env.NODE_ENV ?? ''}:${process.env.CLIENT_URL ?? ''}`;
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

export function getClientAppConfig(): ClientAppConfig {
  const cacheKey = getBrowserOriginsCacheKey();
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

/**
 * Builds a first-party app URL from a server-owned path, including any query string or fragment.
 * Do not pass user-controlled redirect targets through this helper without separate validation.
 */
export function buildClientAppUrl(pathWithQuery: string): string {
  if (/^https?:\/\//i.test(pathWithQuery)) {
    throw new Error(`buildClientAppUrl expects a path, not an absolute URL: ${pathWithQuery}`);
  }

  const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${getClientAppUrl()}${normalizedPath}`;
}

export function getAllowedBrowserOrigins(): string[] {
  const cacheKey = getBrowserOriginsCacheKey();
  if (browserRuntimeState.allowedBrowserOriginsCache?.cacheKey === cacheKey) {
    return browserRuntimeState.allowedBrowserOriginsCache.origins;
  }

  const origins = isProductionEnvironment()
    ? [...new Set([getClientOrigin(), ...FIRST_PARTY_PRODUCTION_ORIGINS])]
    : DEVELOPMENT_ALLOWED_BROWSER_ORIGINS;

  browserRuntimeState.allowedBrowserOriginsCache = {
    cacheKey,
    origins,
  };

  return origins;
}

export function validateProductionBrowserRuntimeConfig() {
  if (!isProductionEnvironment()) {
    return;
  }

  getClientAppConfig();
}
