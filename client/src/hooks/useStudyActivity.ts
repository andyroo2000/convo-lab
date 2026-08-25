import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import {
  decodeStudyActivitySession,
  encodeStudyActivitySession,
  type StudyActivitySessionWire,
} from '../lib/studyActivityContract';
import { studyApiPath } from '../lib/studyApi';
import { decodeStudyTimeAnalytics } from '../lib/learningOsContractDecoders';
import type { StudyActivitySession, StudyActivitySessionInput } from '../types/studyActivity';

// Learning OS numbers Sunday as 1, so Monday is 2.
export const MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING = 2;

export const studyActivityKeys = {
  all: ['study-activity'] as const,
  analytics: (anchorDate: string) => [...studyActivityKeys.all, 'analytics', anchorDate] as const,
  editable: () => [...studyActivityKeys.all, 'editable'] as const,
};

async function activityRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetchWithCsrf(studyApiPath(path), {
    ...init,
    credentials: 'include',
    headers,
  });
  notifyAuthSessionExpired(response);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(body.message ?? 'Unable to save study time.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function saveStudyActivitySessions(
  sessions: Array<StudyActivitySessionInput | StudyActivitySession>
) {
  const storedSessions = await activityRequest<StudyActivitySessionWire[]>(
    '/activity-sessions/batch',
    {
      method: 'POST',
      body: JSON.stringify({ sessions: sessions.map(encodeStudyActivitySession) }),
    }
  );
  return storedSessions.map(decodeStudyActivitySession);
}

interface EditableStudyActivitySessionPageWire {
  items: StudyActivitySessionWire[];
  limit: number;
  nextCursor: string | null;
}

export function useEditableStudyActivitySessions() {
  return useInfiniteQuery({
    queryKey: studyActivityKeys.editable(),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ per_page: '20' });
      if (pageParam) query.set('cursor', pageParam);
      const page = await activityRequest<EditableStudyActivitySessionPageWire>(
        `/activity-sessions/editable?${query.toString()}`
      );
      return {
        ...page,
        items: page.items.map(decodeStudyActivitySession),
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useStudyActivityAnalytics(anchorDate: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return useQuery({
    queryKey: [...studyActivityKeys.analytics(anchorDate), timezone],
    queryFn: async () =>
      decodeStudyTimeAnalytics(
        await activityRequest<unknown>(
          `/activity-analytics?timezone=${encodeURIComponent(
            timezone
          )}&weekStartsOn=${MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING}&anchorDate=${encodeURIComponent(
            anchorDate
          )}&adaptiveAllTime=1`
        )
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSaveStudyActivitySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (session: StudyActivitySessionInput | StudyActivitySession) =>
      saveStudyActivitySessions([session]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studyActivityKeys.all }),
  });
}

export function useDeleteStudyActivitySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientSessionId: string) =>
      activityRequest<void>(`/activity-sessions/${encodeURIComponent(clientSessionId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studyActivityKeys.all }),
  });
}

export function useAutomaticStudyActivity(
  enabled: boolean,
  start: () => void,
  stop: () => void,
  idleMs = 5 * 60 * 1000
) {
  useEffect(() => {
    if (!enabled) {
      stop();
      return undefined;
    }

    let idleTimer: number | undefined;
    const pause = () => {
      window.clearTimeout(idleTimer);
      stop();
    };
    const engage = () => {
      if (document.visibilityState !== 'visible') return;
      start();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(pause, idleMs);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') engage();
      else pause();
    };

    engage();
    window.addEventListener('pointerdown', engage, { passive: true });
    window.addEventListener('keydown', engage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', engage);
      window.removeEventListener('keydown', engage);
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [enabled, idleMs, start, stop]);
}
