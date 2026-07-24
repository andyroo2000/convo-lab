type ClientAppConfigCacheEntry = {
  cacheKey: string;
  config: {
    clientUrl: string;
    clientOrigin: string;
  };
};

type AllowedBrowserOriginsCacheEntry = {
  cacheKey: string;
  origins: string[];
};

export type BrowserRuntimeState = {
  clientAppConfigCache: ClientAppConfigCacheEntry | null;
  allowedBrowserOriginsCache: AllowedBrowserOriginsCacheEntry | null;
  warnedClientUrlCacheKeys: Set<string>;
};

export const browserRuntimeState: BrowserRuntimeState = {
  clientAppConfigCache: null,
  allowedBrowserOriginsCache: null,
  warnedClientUrlCacheKeys: new Set<string>(),
};

export function resetBrowserRuntimeState() {
  browserRuntimeState.clientAppConfigCache = null;
  browserRuntimeState.allowedBrowserOriginsCache = null;
  browserRuntimeState.warnedClientUrlCacheKeys.clear();
}
