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

export type BrowserRuntimeState = {
  clientAppConfigCache: ClientAppConfigCacheEntry | null;
  csrfSecretConfigCache: CsrfSecretConfigCacheEntry | null;
  warnedClientUrlCacheKeys: Set<string>;
  warnedCsrfSecretCacheKeys: Set<string>;
};

export const browserRuntimeState: BrowserRuntimeState = {
  clientAppConfigCache: null,
  csrfSecretConfigCache: null,
  warnedClientUrlCacheKeys: new Set<string>(),
  warnedCsrfSecretCacheKeys: new Set<string>(),
};

export function getBrowserRuntimeState(): Readonly<BrowserRuntimeState> {
  return browserRuntimeState;
}

export function resetBrowserRuntimeState() {
  browserRuntimeState.clientAppConfigCache = null;
  browserRuntimeState.csrfSecretConfigCache = null;
  browserRuntimeState.warnedClientUrlCacheKeys.clear();
  browserRuntimeState.warnedCsrfSecretCacheKeys.clear();
}
