import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import type {
  DailyAudioPractice,
  DailyAudioPracticeStatusResponse,
  DailyAudioPracticeTrack,
} from '../types';
import { useFeatureFlags, type FeatureFlags } from './useFeatureFlags';

const DEFAULT_DAILY_AUDIO_DURATION_MINUTES = 30;
const LEARNING_OS_DAILY_AUDIO_PROXY_BASE = '/api/learning-os/study/daily-audio-practice';

export const dailyAudioPracticeKeys = {
  all: ['daily-audio-practice'] as const,
  list: (source?: 'convo-lab' | 'learning-os') =>
    [...dailyAudioPracticeKeys.all, 'list', ...(source ? [source] : [])] as const,
  detail: (id: string, source?: 'convo-lab' | 'learning-os') =>
    [...dailyAudioPracticeKeys.all, 'detail', id, ...(source ? [source] : [])] as const,
  status: (id: string, source?: 'convo-lab' | 'learning-os') =>
    [...dailyAudioPracticeKeys.all, 'status', id, ...(source ? [source] : [])] as const,
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

function shouldUseLearningOsDailyAudio(flags?: FeatureFlags): boolean {
  return flags?.studyApiEnabled === true && flags.studyApiDailyAudio === true;
}

function dailyAudioApiSource(flags?: FeatureFlags): 'convo-lab' | 'learning-os' {
  return shouldUseLearningOsDailyAudio(flags) ? 'learning-os' : 'convo-lab';
}

function readEndpoint(endpoint: string, flags?: FeatureFlags): string {
  if (!shouldUseLearningOsDailyAudio(flags)) {
    return endpoint;
  }

  return endpoint.replace(
    /^\/api\/daily-audio-practice(?=\/|$)/,
    LEARNING_OS_DAILY_AUDIO_PROXY_BASE
  );
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

  notifyAuthSessionExpired(response);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(extractErrorMessage(errorBody));
  }

  return response.json() as Promise<T>;
}

async function fetchRecentDailyAudioPractice(flags?: FeatureFlags) {
  const practices = await apiRequest<DailyAudioPractice[]>(
    readEndpoint('/api/daily-audio-practice', flags)
  );
  return practices.map((practice) => ({ ...practice, tracks: normalizeTracks(practice.tracks) }));
}

async function fetchDailyAudioPractice(id: string, flags?: FeatureFlags) {
  const practice = await apiRequest<DailyAudioPractice>(
    readEndpoint(`/api/daily-audio-practice/${encodeURIComponent(id)}`, flags)
  );
  return { ...practice, tracks: normalizeTracks(practice.tracks) };
}

async function fetchDailyAudioPracticeStatus(id: string, flags?: FeatureFlags) {
  return apiRequest<DailyAudioPracticeStatusResponse>(
    readEndpoint(`/api/daily-audio-practice/${encodeURIComponent(id)}/status`, flags)
  );
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
  const { flags } = useFeatureFlags();
  const source = dailyAudioApiSource(flags);

  return useQuery({
    queryKey: dailyAudioPracticeKeys.list(source),
    queryFn: () => fetchRecentDailyAudioPractice(flags),
  });
}

export function useDailyAudioPractice(id: string | undefined) {
  const { flags } = useFeatureFlags();
  const source = dailyAudioApiSource(flags);

  return useQuery({
    queryKey: dailyAudioPracticeKeys.detail(id ?? 'pending', source),
    queryFn: () => fetchDailyAudioPractice(id!, flags),
    enabled: Boolean(id),
  });
}

export function useDailyAudioPracticeStatus(id: string | undefined, enabled: boolean) {
  const { flags } = useFeatureFlags();
  const source = dailyAudioApiSource(flags);

  return useQuery({
    queryKey: dailyAudioPracticeKeys.status(id ?? 'pending', source),
    queryFn: () => fetchDailyAudioPracticeStatus(id!, flags),
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
