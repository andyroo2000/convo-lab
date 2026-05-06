import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { fetchWithCsrf } from '../lib/csrf';
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

  const response = await fetchWithCsrf(`${API_URL}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(extractErrorMessage(errorBody));
  }

  return response.json() as Promise<T>;
}

async function fetchRecentDailyAudioPractice() {
  const practices = await apiRequest<DailyAudioPractice[]>('/api/daily-audio-practice');
  return practices.map((practice) => ({ ...practice, tracks: normalizeTracks(practice.tracks) }));
}

async function fetchDailyAudioPractice(id: string) {
  const practice = await apiRequest<DailyAudioPractice>(`/api/daily-audio-practice/${id}`);
  return { ...practice, tracks: normalizeTracks(practice.tracks) };
}

async function fetchDailyAudioPracticeStatus(id: string) {
  return apiRequest<DailyAudioPracticeStatusResponse>(`/api/daily-audio-practice/${id}/status`);
}

async function createDailyAudioPractice() {
  return apiRequest<DailyAudioPractice>('/api/daily-audio-practice', {
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
