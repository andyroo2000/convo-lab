import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config';
import { fetchWithCsrf } from '../lib/csrf';

export interface KnownKanjiResponse {
  version: number;
  kanji: string[];
  manualKanji: string[];
  wanikani: {
    connected: boolean;
    lastSyncedAt: string | null;
  };
}

export interface WaniKaniSyncResponse {
  added: number;
  effectiveTotal: number;
  version: number;
}

const KNOWN_KANJI_QUERY_KEY = ['study', 'known-kanji'] as const;
const KNOWN_KANJI_ENDPOINT = `${API_URL.replace(/\/+$/, '')}/api/learning-os/study/known-kanji`;
const WANIKANI_ENDPOINT = `${API_URL.replace(/\/+$/, '')}/api/learning-os/study/wanikani`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetchWithCsrf(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error?.message || 'Request failed');
  }
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function useKnownKanji() {
  return useQuery({
    queryKey: KNOWN_KANJI_QUERY_KEY,
    queryFn: () => request<KnownKanjiResponse>(KNOWN_KANJI_ENDPOINT),
    staleTime: 5 * 60 * 1000,
  });
}

export function useConnectWaniKani() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiToken: string) =>
      request<KnownKanjiResponse>(WANIKANI_ENDPOINT, {
        method: 'PUT',
        body: JSON.stringify({ apiToken }),
      }),
    onSuccess: (data) => queryClient.setQueryData(KNOWN_KANJI_QUERY_KEY, data),
  });
}

export function useDisconnectWaniKani() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => request<void>(WANIKANI_ENDPOINT, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KNOWN_KANJI_QUERY_KEY }),
  });
}

export function useSyncWaniKani() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      request<WaniKaniSyncResponse>(`${WANIKANI_ENDPOINT}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KNOWN_KANJI_QUERY_KEY }),
  });
}

export function useSetManualKnownKanji() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ kanji, known }: { kanji: string; known: boolean }) =>
      request<KnownKanjiResponse>(`${KNOWN_KANJI_ENDPOINT}/manual`, {
        method: 'PATCH',
        body: JSON.stringify({ kanji, known }),
      }),
    onSuccess: (data) => queryClient.setQueryData(KNOWN_KANJI_QUERY_KEY, data),
  });
}
