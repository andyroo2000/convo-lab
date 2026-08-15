import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import {
  decodeStudyActivitySession,
  encodeStudyActivitySession,
  type StudyActivitySessionWire,
} from '../lib/studyActivityContract';
import { studyApiPath } from '../lib/studyApi';
import type {
  StudyActivitySession,
  StudyActivitySessionInput,
  StudyTimeAnalytics,
} from '../types/studyActivity';

// Learning OS numbers Sunday as 1, so Monday is 2.
export const MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING = 2;

export const studyActivityKeys = {
  all: ['study-activity'] as const,
  range: (from: string, to: string) => [...studyActivityKeys.all, from, to] as const,
  analytics: (anchorDate: string) => [...studyActivityKeys.all, 'analytics', anchorDate] as const,
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

export function useStudyActivitySessions(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: studyActivityKeys.range(fromIso, toIso),
    queryFn: async () => {
      const sessions = await activityRequest<StudyActivitySessionWire[]>(
        `/activity-sessions?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      );
      return sessions.map(decodeStudyActivitySession);
    },
  });
}

export function useStudyActivityAnalytics(anchorDate: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return useQuery({
    queryKey: [...studyActivityKeys.analytics(anchorDate), timezone],
    queryFn: () =>
      activityRequest<StudyTimeAnalytics>(
        `/activity-analytics?timezone=${encodeURIComponent(
          timezone
        )}&weekStartsOn=${MONDAY_IN_LEARNING_OS_WEEKDAY_NUMBERING}&anchorDate=${encodeURIComponent(
          anchorDate
        )}&adaptiveAllTime=1`
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
