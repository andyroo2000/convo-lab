import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { DAILY_AUDIO_API_BASE } from '../lib/studyApi';
import type {
  DailyAudioPractice,
  DailyAudioPracticeStatusResponse,
  DailyAudioPracticeTrack,
} from '../types';

const DEFAULT_DAILY_AUDIO_DURATION_MINUTES = 30;
export const dailyAudioPracticeKeys = {
  all: ['daily-audio-practice'] as const,
  list: () => [...dailyAudioPracticeKeys.all, 'list'] as const,
  detail: (id: string) => [...dailyAudioPracticeKeys.all, 'detail', id] as const,
  status: (id: string) => [...dailyAudioPracticeKeys.all, 'status', id] as const,
};

function normalizeTracks(tracks: DailyAudioPracticeTrack[] = []) {
  return [...tracks].sort((left, right) => left.sortOrder - right.sortOrder);
}

function extractErrorMessage(errorBody: unknown): string {
  if (!errorBody || typeof errorBody !== 'object') return 'Request failed';
  const record = errorBody as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const errorRecord = record.error as Record<string, unknown>;
    if (typeof errorRecord.message === 'string') return errorRecord.message;
  }
  return 'Request failed';
}

async function apiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetchWithCsrf(endpoint, {
    ...init,
    credentials: 'include',
    headers,
  });

  notifyAuthSessionExpired(response);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(extractErrorMessage(errorBody));
  }

  return response.json() as Promise<T>;
}

async function fetchRecentDailyAudioPractice() {
  const practices = await apiRequest<DailyAudioPractice[]>(DAILY_AUDIO_API_BASE);
  return practices.map((practice) => ({ ...practice, tracks: normalizeTracks(practice.tracks) }));
}

async function fetchDailyAudioPractice(id: string) {
  const practice = await apiRequest<DailyAudioPractice>(
    `${DAILY_AUDIO_API_BASE}/${encodeURIComponent(id)}`
  );
  return { ...practice, tracks: normalizeTracks(practice.tracks) };
}

async function fetchDailyAudioPracticeStatus(id: string) {
  return apiRequest<DailyAudioPracticeStatusResponse>(
    `${DAILY_AUDIO_API_BASE}/${encodeURIComponent(id)}/status`
  );
}

async function createDailyAudioPractice() {
  return apiRequest<DailyAudioPractice>(DAILY_AUDIO_API_BASE, {
    method: 'POST',
    body: JSON.stringify({
      timeZone: getDeviceStudyTimeZone(),
      targetDurationMinutes: DEFAULT_DAILY_AUDIO_DURATION_MINUTES,
    }),
  });
}

export function useRecentDailyAudioPractice() {
  return useQuery({
    queryKey: dailyAudioPracticeKeys.list(),
    queryFn: fetchRecentDailyAudioPractice,
  });
}

export function useDailyAudioPractice(id: string | undefined) {
  return useQuery({
    queryKey: dailyAudioPracticeKeys.detail(id ?? 'pending'),
    queryFn: () => fetchDailyAudioPractice(id!),
    enabled: Boolean(id),
  });
}

export function useDailyAudioPracticeStatus(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dailyAudioPracticeKeys.status(id ?? 'pending'),
    queryFn: () => fetchDailyAudioPracticeStatus(id!),
    enabled: Boolean(id) && enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}

export function useCreateDailyAudioPractice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDailyAudioPractice,
    onSuccess: (practice) => {
      queryClient.setQueryData(dailyAudioPracticeKeys.detail(practice.id), {
        ...practice,
        tracks: normalizeTracks(practice.tracks),
      });
      queryClient.invalidateQueries({ queryKey: dailyAudioPracticeKeys.list() });
    },
  });
}
