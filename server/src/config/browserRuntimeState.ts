import type { CsrfSecretSource } from './browserRuntime.js';

type ClientAppConfigCacheEntry = {
  cacheKey: string;
  config: {
    clientUrl: string;
    clientOrigin: string;
  };
};

type CsrfSecretConfigCacheEntry = {
  cacheKey: string;
  config: {
    secret: string;
    source: CsrfSecretSource;
  };
};

type AllowedBrowserOriginsCacheEntry = {
  cacheKey: string;
  origins: string[];
};

export type BrowserRuntimeState = {
  clientAppConfigCache: ClientAppConfigCacheEntry | null;
  csrfSecretConfigCache: CsrfSecretConfigCacheEntry | null;
  allowedBrowserOriginsCache: AllowedBrowserOriginsCacheEntry | null;
  warnedClientUrlCacheKeys: Set<string>;
  warnedCsrfSecretCacheKeys: Set<string>;
};

export type BrowserRuntimeStateSnapshot = {
  clientAppConfigCache: ClientAppConfigCacheEntry | null;
  csrfSecretConfigCache: CsrfSecretConfigCacheEntry | null;
  allowedBrowserOriginsCache: AllowedBrowserOriginsCacheEntry | null;
  warnedClientUrlCacheKeys: ReadonlySet<string>;
  warnedCsrfSecretCacheKeys: ReadonlySet<string>;
};

export const browserRuntimeState: BrowserRuntimeState = {
  clientAppConfigCache: null,
  csrfSecretConfigCache: null,
  allowedBrowserOriginsCache: null,
  warnedClientUrlCacheKeys: new Set<string>(),
  warnedCsrfSecretCacheKeys: new Set<string>(),
};

export function getBrowserRuntimeState(): BrowserRuntimeStateSnapshot {
  return {
    clientAppConfigCache: browserRuntimeState.clientAppConfigCache,
    csrfSecretConfigCache: browserRuntimeState.csrfSecretConfigCache,
    allowedBrowserOriginsCache: browserRuntimeState.allowedBrowserOriginsCache,
    warnedClientUrlCacheKeys: new Set(browserRuntimeState.warnedClientUrlCacheKeys),
    warnedCsrfSecretCacheKeys: new Set(browserRuntimeState.warnedCsrfSecretCacheKeys),
  };
}

export function resetBrowserRuntimeState() {
  browserRuntimeState.clientAppConfigCache = null;
  browserRuntimeState.csrfSecretConfigCache = null;
  browserRuntimeState.allowedBrowserOriginsCache = null;
  browserRuntimeState.warnedClientUrlCacheKeys.clear();
  browserRuntimeState.warnedCsrfSecretCacheKeys.clear();
}
