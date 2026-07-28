import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';
import type { StudyActivitySession } from '../types/studyActivity';

export const studyActivityKeys = {
  all: ['study-activity'] as const,
  range: (from: string, to: string) => [...studyActivityKeys.all, from, to] as const,
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
  return response.json() as Promise<T>;
}

export async function saveStudyActivitySessions(sessions: StudyActivitySession[]) {
  return activityRequest<StudyActivitySession[]>('/activity-sessions/batch', {
    method: 'POST',
    body: JSON.stringify({ sessions }),
  });
}

export function useStudyActivitySessions(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: studyActivityKeys.range(fromIso, toIso),
    queryFn: () =>
      activityRequest<StudyActivitySession[]>(
        `/activity-sessions?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      ),
  });
}

export function useSaveStudyActivitySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (session: StudyActivitySession) => saveStudyActivitySessions([session]),
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
