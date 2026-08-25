import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_TOKEN_COOKIE_NAME, resetCsrfStateForTests } from '../../lib/csrf';
import { studyCardCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';
import { useCreateCardFromStudyManualCardDraft, useStudyManualCardDrafts } from '../useStudy';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8080',
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
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-csrf-token; path=/`;
        return { ok: true, status: 204 } as Response;
      }

      if (String(input).endsWith(`/card-drafts/${draftId}/create-card`)) {
        commitAttempt += 1;
        if (commitAttempt === 1) {
          throw new TypeError('Network request failed');
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...(studyCardCompatibilityFixture.cases[0].payload as object),
            id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          }),
        } as Response;
      }

      expect(String(input)).toBe(`/api/study/card-drafts/${draftId}`);
      expect(init?.method).toBe('DELETE');
      return { ok: true, status: 204 } as Response;
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateCardFromStudyManualCardDraft(), { wrapper });
    const draft = { id: draftId, committedCardId: null };

    let firstError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(draft);
      } catch (error) {
        firstError = error;
      }
    });
    expect(firstError).toEqual(new TypeError('Network request failed'));
    await act(async () => {
      await result.current.mutateAsync(draft);
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
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input) === `/api/study/card-drafts/${draftId}` && init?.method === 'DELETE'
      )
    ).toHaveLength(1);
  });

  it('reuses the committed card ID when draft cleanup must be retried', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FBX';
    let cleanupAttempt = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-csrf-token; path=/`;
        return { ok: true, status: 204 } as Response;
      }

      if (String(input).endsWith(`/card-drafts/${draftId}/create-card`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...(studyCardCompatibilityFixture.cases[0].payload as object),
            id: '01ARZ3NDEKTSV4RRFFQ69G5FBV',
          }),
        } as Response;
      }

      expect(String(input)).toBe(`/api/study/card-drafts/${draftId}`);
      expect(init?.method).toBe('DELETE');
      cleanupAttempt += 1;
      if (cleanupAttempt === 1) {
        throw new TypeError('Network request failed');
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Draft not found' }),
      } as Response;
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateCardFromStudyManualCardDraft(), { wrapper });
    const draft = { id: draftId, committedCardId: null };

    await act(async () => {
      await expect(result.current.mutateAsync(draft)).rejects.toEqual(
        new TypeError('Network request failed')
      );
    });
    let committedCardId: string | undefined;
    await act(async () => {
      const committedResult = await result.current.mutateAsync(draft);
      committedCardId = committedResult.card.id;
    });

    const commitCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith(`/card-drafts/${draftId}/create-card`)
    );
    const requestIds = commitCalls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).id
    );
    expect(requestIds).toHaveLength(2);
    expect(requestIds[1]).toBe(requestIds[0]);
    expect(cleanupAttempt).toBe(2);
    expect(committedCardId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FBV');
  });

  it('reconciles a committed draft after the browser lost its pending card ID', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FCX';
    const committedCardId = '01ARZ3NDEKTSV4RRFFQ69G5FCV';
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) === '/sanctum/csrf-cookie') {
        document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-os-csrf-token; path=/`;
        return { ok: true, status: 204 } as Response;
      }

      if (String(input).endsWith(`/card-drafts/${draftId}/create-card`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...(studyCardCompatibilityFixture.cases[0].payload as object),
            id: committedCardId,
          }),
        } as Response;
      }

      expect(String(input)).toBe(`/api/study/card-drafts/${draftId}`);
      expect(init?.method).toBe('DELETE');
      return { ok: true, status: 204 } as Response;
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateCardFromStudyManualCardDraft(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: draftId, committedCardId });
    });

    const commitCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith(`/card-drafts/${draftId}/create-card`)
    );
    expect(commitCall).toBeDefined();
    expect(JSON.parse(String((commitCall?.[1] as RequestInit).body)).id).toBe(committedCardId);
  });
});

describe('manual card draft query ownership', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fetch or expose another owner cache while the effective owner is unresolved', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ drafts: [], nextCursor: null, total: 0 }),
        }) as Response
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ ownerId }: { ownerId: string | null }) => useStudyManualCardDrafts(ownerId),
      { initialProps: { ownerId: null as string | null }, wrapper }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();

    rerender({ ownerId: 'user-a' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ ownerId: null });
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ ownerId: 'user-b' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
