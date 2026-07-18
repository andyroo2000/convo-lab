import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_TOKEN_COOKIE_NAME } from '../../lib/csrf';
import { useCreateCardFromStudyManualCardDraft } from '../useStudy';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
  SHOW_ONBOARDING_WELCOME: false,
}));

vi.mock('../useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      studyApiEnabled: true,
      studyApiCardDrafts: true,
    },
  }),
}));

describe('manual card draft mutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token; path=/`;
  });

  it('reuses the client-generated card ID after an ambiguous commit failure', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          draftId,
          card: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', cardType: 'recognition' },
        }),
      } as Response);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateCardFromStudyManualCardDraft(), { wrapper });

    let firstError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(draftId);
      } catch (error) {
        firstError = error;
      }
    });
    expect(firstError).toEqual(new TypeError('Network request failed'));
    await act(async () => {
      await result.current.mutateAsync(draftId);
    });

    const requestIds = vi
      .mocked(global.fetch)
      .mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).id);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(requestIds[1]).toBe(requestIds[0]);
  });
});
