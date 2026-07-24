import { beforeEach, describe, expect, it, vi } from 'vitest';

const { activateListeners, cacheDeleteMock, registerRouteMock, skipWaitingMock } = vi.hoisted(
  () => ({
    activateListeners: [] as Array<(event: { waitUntil(promise: Promise<unknown>): void }) => void>,
    cacheDeleteMock: vi.fn(),
    registerRouteMock: vi.fn(),
    skipWaitingMock: vi.fn(),
  })
);

vi.mock('workbox-core', () => ({
  clientsClaim: vi.fn(),
}));

vi.mock('workbox-cacheable-response', () => ({
  CacheableResponsePlugin: vi.fn(),
}));

vi.mock('workbox-expiration', () => ({
  ExpirationPlugin: vi.fn(),
}));

vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  precacheAndRoute: vi.fn(),
}));

vi.mock('workbox-range-requests', () => ({
  RangeRequestsPlugin: vi.fn(),
}));

vi.mock('workbox-routing', () => ({
  registerRoute: registerRouteMock,
}));

vi.mock('workbox-strategies', () => ({
  CacheFirst: vi.fn(function CacheFirst(this: { handleAll(): [Promise<Response>, Promise<void>] }) {
    this.handleAll = () => [Promise.resolve(new Response()), Promise.resolve()];
  }),
  NetworkFirst: vi.fn(),
}));

describe('service worker caching', () => {
  beforeEach(async () => {
    vi.resetModules();
    activateListeners.length = 0;
    cacheDeleteMock.mockReset();
    cacheDeleteMock.mockResolvedValue(true);
    registerRouteMock.mockReset();
    skipWaitingMock.mockReset();

    vi.stubGlobal('caches', {
      delete: cacheDeleteMock,
    });
    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn(
        (
          type: string,
          listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void
        ) => {
          if (type === 'activate') activateListeners.push(listener);
        }
      ),
      location: {
        origin: 'https://convo-lab.com',
      },
      skipWaiting: skipWaitingMock,
    });

    await import('../sw');
  });

  it.each(['/api/auth/me', '/api/study/overview', '/api/daily-audio-practice'])(
    'does not cache authenticated API request %s',
    (pathname) => {
      const url = new URL(pathname, 'https://convo-lab.com');
      const request = new Request(url);
      const routeMatchers = registerRouteMock.mock.calls
        .map(([matcher]) => matcher)
        .filter(
          (matcher): matcher is (context: unknown) => boolean => typeof matcher === 'function'
        );

      expect(
        routeMatchers.some((matcher) =>
          matcher({
            request,
            url,
            sameOrigin: true,
          })
        )
      ).toBe(false);
    }
  );

  it('deletes authenticated responses left by the legacy API cache', async () => {
    expect(activateListeners).toHaveLength(1);

    let cleanup: Promise<unknown> | undefined;
    activateListeners[0]?.({
      waitUntil(promise) {
        cleanup = promise;
      },
    });

    await cleanup;
    expect(cacheDeleteMock).toHaveBeenCalledWith('api-cache');
  });
});
