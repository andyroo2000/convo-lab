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
    source: 'CSRF_SECRET' | 'COOKIE_SECRET' | 'JWT_SECRET' | 'development-fallback';
  };
};

export const browserRuntimeState: {
  clientAppConfigCache: ClientAppConfigCacheEntry | null;
  csrfSecretConfigCache: CsrfSecretConfigCacheEntry | null;
  warnedClientUrlCacheKeys: Set<string>;
  warnedCsrfSecretCacheKeys: Set<string>;
} = {
  clientAppConfigCache: null,
  csrfSecretConfigCache: null,
  warnedClientUrlCacheKeys: new Set<string>(),
  warnedCsrfSecretCacheKeys: new Set<string>(),
};

export function resetBrowserRuntimeState() {
  browserRuntimeState.clientAppConfigCache = null;
  browserRuntimeState.csrfSecretConfigCache = null;
  browserRuntimeState.warnedClientUrlCacheKeys.clear();
  browserRuntimeState.warnedCsrfSecretCacheKeys.clear();
}
