import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_TOKEN_COOKIE_NAME, resetCsrfStateForTests } from '../../lib/csrf';
import { useCreateCardFromStudyManualCardDraft } from '../useStudy';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
  SHOW_ONBOARDING_WELCOME: false,
}));

describe('manual card draft mutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCsrfStateForTests();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token; path=/`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCsrfStateForTests();
  });

  it('reuses the client-generated card ID after an ambiguous commit failure', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    let commitAttempt = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-csrf-token; path=/`;
        return { ok: true, status: 204 } as Response;
      }

      commitAttempt += 1;
      if (commitAttempt === 1) {
        throw new TypeError('Network request failed');
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          draftId,
          card: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', cardType: 'recognition' },
        }),
      } as Response;
    });
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

    const commitCalls = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) =>
        String(input).endsWith(`/card-drafts/${draftId}/create-card`)
      );
    const requestIds = commitCalls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).id
    );

    expect(commitCalls.map(([input]) => String(input))).toEqual([
      `/api/study/card-drafts/${draftId}/create-card`,
      `/api/study/card-drafts/${draftId}/create-card`,
    ]);
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(requestIds[1]).toBe(requestIds[0]);
  });
});
