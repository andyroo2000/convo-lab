import { vi } from 'vitest';

import {
  mockFeatureFlags,
  mockPronunciationDictionary,
  mockSpeakerAvatars,
} from './AdminPageTestHarness';

type ResponseResolver = (response: unknown) => void;
type FeatureKey = 'dialoguesEnabled' | 'scriptsEnabled';
type SettingsMutation = 'feature' | 'pronunciation';

interface FetchRoute {
  contains: string;
  endsWith?: string;
  method?: string;
  respond: (init?: RequestInit) => unknown;
}

const okJson = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

function matchesRoute(route: FetchRoute, url: string, init?: RequestInit) {
  if (!url.includes(route.contains)) return false;
  if (route.endsWith && !url.endsWith(route.endsWith)) return false;
  return !route.method || route.method === init?.method;
}

function installFetchRoutes(routes: FetchRoute[]) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const route = routes.find((candidate) => matchesRoute(candidate, String(input), init));
    if (route) return Promise.resolve(route.respond(init));
    return Promise.reject(new Error('Unknown endpoint'));
  }) as typeof fetch;
}

const csrfRoute = (): FetchRoute => ({
  contains: '/sanctum/csrf-cookie',
  respond: () => ({ ok: true }),
});

const avatarReadRoutes = (): FetchRoute[] => [
  {
    contains: '/api/convolab/admin/avatars/speakers',
    respond: () => okJson(mockSpeakerAvatars),
  },
  {
    contains: '/api/convolab/admin/users',
    respond: () => okJson({ users: [] }),
  },
];

const originalAvatarRoute = (): FetchRoute => ({
  contains: '/avatars/speaker/',
  endsWith: '/original',
  respond: () => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ originalUrl: 'https://example.com/original.jpg' }),
  }),
});

const settingsReadRoutes = (): FetchRoute[] => [
  {
    contains: '/api/feature-flags',
    respond: () => okJson(mockFeatureFlags),
  },
  {
    contains: '/api/convolab/admin/pronunciation-dictionaries',
    respond: () => okJson(mockPronunciationDictionary),
  },
];

function abortingResponse(signal?: AbortSignal | null) {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener(
      'abort',
      () => reject(new DOMException('The operation was aborted.', 'AbortError')),
      { once: true }
    );
  });
}

export function mockRecropFailure(status: number, message: string) {
  installFetchRoutes([
    csrfRoute(),
    originalAvatarRoute(),
    {
      contains: '/avatars/speaker/',
      endsWith: '/recrop',
      respond: (init) => ({
        ok: false,
        status,
        json: () => Promise.resolve({ message, method: init?.method }),
      }),
    },
    ...avatarReadRoutes(),
  ]);
}

export function mockPendingRecrop(onRequest: (signal: AbortSignal | undefined) => void) {
  installFetchRoutes([
    csrfRoute(),
    originalAvatarRoute(),
    {
      contains: '/avatars/speaker/',
      endsWith: '/recrop',
      respond: (init) => {
        onRequest(init?.signal ?? undefined);
        return abortingResponse(init?.signal);
      },
    },
    ...avatarReadRoutes(),
  ]);
}

export function mockSpeakerUploadFailure(
  status: number,
  message: string,
  onRequest: (init: RequestInit | undefined) => void
) {
  installFetchRoutes([
    csrfRoute(),
    {
      contains: '/avatars/speaker/',
      endsWith: '/upload',
      respond: (init) => {
        onRequest(init);
        return {
          ok: false,
          status,
          json: () => Promise.resolve({ message }),
        };
      },
    },
    ...avatarReadRoutes(),
  ]);
}

export function mockConcurrentFeatureMutations(
  onPending: (key: FeatureKey, resolve: ResponseResolver) => void
) {
  installFetchRoutes([
    csrfRoute(),
    {
      contains: '/api/feature-flags',
      method: 'PATCH',
      respond: (init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, boolean>;
        const key = Object.keys(body)[0] as FeatureKey;
        return new Promise((resolve) => {
          onPending(key, resolve);
        });
      },
    },
    ...settingsReadRoutes(),
  ]);
}

export function mockPendingSettingsMutations(
  onPending: (kind: SettingsMutation, init: RequestInit) => void
) {
  const mutationRoute = (kind: SettingsMutation, contains: string, method: string): FetchRoute => ({
    contains,
    method,
    respond: (init) => {
      const request = init as RequestInit;
      onPending(kind, request);
      return abortingResponse(request.signal);
    },
  });

  installFetchRoutes([
    csrfRoute(),
    mutationRoute('feature', '/api/feature-flags', 'PATCH'),
    mutationRoute('pronunciation', '/api/convolab/admin/pronunciation-dictionaries', 'PUT'),
    ...settingsReadRoutes(),
  ]);
}
