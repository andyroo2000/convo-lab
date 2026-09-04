import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';
import { decodeGoogleCalendarConnectionStatus } from '../lib/learningOsContractDecoders';
import { studyActivityKeys } from './useStudyActivity';
import {
  canonicalizeGoogleCalendarSettings,
  type GoogleCalendarSettings,
  type GoogleCalendarSettingsError,
} from '../utils/googleCalendarSettings';

export interface GoogleCalendarListItem {
  id: string;
  name: string;
  primary: boolean;
}

export interface GoogleCalendarList {
  calendars: GoogleCalendarListItem[];
  truncated: boolean;
}

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
  scopes: string[];
  settings: GoogleCalendarSettings | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  sync: GoogleCalendarSyncStatus | null;
  nextLesson?: {
    title: string;
    startsAt: string;
    endsAt: string;
  } | null;
}

export interface GoogleCalendarSyncStatus {
  status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  errorCode: string | null;
  statusAt: string | null;
}

export interface GoogleCalendarPreviewMatch {
  calendarId: string;
  calendarName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMs: number;
  matchedTerms: string[];
  alreadySynced: boolean;
}

export interface GoogleCalendarPreview {
  generatedAt: string;
  startsAt: string;
  endsAt: string;
  scannedEventCount: number;
  matchedEventCount: number;
  truncated: boolean;
  matches: GoogleCalendarPreviewMatch[];
}

export interface GoogleCalendarPreviewCriteria {
  calendarIds: string[];
  titleMatchTerms: string[];
}

export const googleCalendarKeys = {
  all: ['study', 'google-calendar'] as const,
  connection: () => [...googleCalendarKeys.all, 'connection'] as const,
  calendars: () => [...googleCalendarKeys.all, 'calendars'] as const,
};
export const googleCalendarConnectionKey = googleCalendarKeys.connection();
export const googleCalendarConnectPath = studyApiPath('/google-calendar/connect');

const isActiveSync = (status: GoogleCalendarSyncStatus['status'] | undefined) =>
  status === 'queued' || status === 'running';

// A query-client-scoped marker survives card navigation while avoiding duplicate refreshes.
const pendingStudyActivityRefreshes = new WeakSet<QueryClient>();
export const GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export const googleCalendarSyncPollInterval = (
  status: GoogleCalendarSyncStatus['status'] | undefined,
  timedOut = false
) => (isActiveSync(status) && !timedOut ? 2000 : false);

export const googleCalendarSyncTimeoutRemaining = (statusAt: string | null, now: number) => {
  const startedAt = statusAt ? Date.parse(statusAt) : Number.NaN;
  return Number.isFinite(startedAt)
    ? Math.min(
        GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS,
        Math.max(0, GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS - (now - startedAt))
      )
    : GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS;
};

export type GoogleCalendarErrorKind =
  | 'not_connected'
  | 'validation'
  | 'rate_limited'
  | 'unavailable'
  | 'request_failed';

const ERROR_MESSAGES: Record<GoogleCalendarErrorKind, string> = {
  not_connected: 'Reconnect Google Calendar to continue.',
  validation: 'Check your Google Calendar settings and try again.',
  rate_limited: 'Google Calendar is receiving too many requests. Please try again shortly.',
  unavailable: 'Google Calendar is temporarily unavailable. Please try again.',
  request_failed: "Couldn't communicate with Google Calendar. Please try again.",
};

export class GoogleCalendarRequestError extends Error {
  constructor(
    public readonly kind: GoogleCalendarErrorKind,
    public readonly status: number | null,
    public readonly validationErrors: GoogleCalendarSettingsError[] = []
  ) {
    super(ERROR_MESSAGES[kind]);
    this.name = 'GoogleCalendarRequestError';
  }
}

function errorKind(status: number): GoogleCalendarErrorKind {
  // Active sync triggers are idempotent 202s; 409 is reserved for a missing connection.
  if (status === 409) return 'not_connected';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503) return 'unavailable';
  return 'request_failed';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const calendarSettingsFieldForErrorKey = (
  key: string
): GoogleCalendarSettingsError['field'] | null => {
  if (key === 'calendarIds' || key.startsWith('calendarIds.')) return 'calendarIds';
  if (key === 'titleMatchTerms' || key.startsWith('titleMatchTerms.')) {
    return 'titleMatchTerms';
  }
  return key === 'syncEnabled' ? 'syncEnabled' : null;
};

function validationErrorsFromPayload(payload: unknown): GoogleCalendarSettingsError[] {
  if (!isRecord(payload) || !isRecord(payload.errors)) return [];

  const fields = new Set<GoogleCalendarSettingsError['field']>();
  Object.keys(payload.errors).forEach((key) => {
    const field = calendarSettingsFieldForErrorKey(key);
    if (field) fields.add(field);
  });
  return [...fields].map((field) => ({ field, code: 'server_rejected' }));
}

const googleCalendarHeaders = (init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  return headers;
};

const throwGoogleCalendarRequestError = async (response: Response): Promise<never> => {
  const validationErrors =
    response.status === 422
      ? validationErrorsFromPayload(await response.json().catch(() => null))
      : [];
  throw new GoogleCalendarRequestError(
    errorKind(response.status),
    response.status,
    validationErrors
  );
};

async function googleCalendarRequest<T>(path = '', init?: RequestInit): Promise<T> {
  const response = await fetchWithCsrf(studyApiPath(`/google-calendar${path}`), {
    ...init,
    credentials: 'include',
    headers: googleCalendarHeaders(init),
  });
  notifyAuthSessionExpired(response);

  if (!response.ok) return throwGoogleCalendarRequestError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

type GoogleCalendarRefetch = () => Promise<{ data?: GoogleCalendarConnectionStatus }>;

const refreshSyncPollingState = async (
  refetch: GoogleCalendarRefetch,
  isCurrent: () => boolean,
  setSyncPollingTimedOut: (timedOut: boolean) => void
) => {
  try {
    const refreshed = await refetch();
    if (isCurrent()) {
      setSyncPollingTimedOut(isActiveSync(refreshed.data?.sync?.status));
    }
  } catch {
    if (isCurrent()) setSyncPollingTimedOut(true);
  }
};

const startSyncPollingTimeout = (
  status: GoogleCalendarSyncStatus['status'] | undefined,
  statusAt: string | null,
  refetch: GoogleCalendarRefetch,
  setSyncPollingTimedOut: (timedOut: boolean) => void
) => {
  let current = true;
  setSyncPollingTimedOut(false);
  const markStale = () => {
    current = false;
  };
  if (!isActiveSync(status)) return markStale;

  const finishPolling = () =>
    refreshSyncPollingState(refetch, () => current, setSyncPollingTimedOut);

  const remaining = googleCalendarSyncTimeoutRemaining(statusAt, Date.now());
  if (remaining === 0) {
    finishPolling().catch(() => undefined);
    return markStale;
  }
  const timeout = window.setTimeout(() => {
    finishPolling().catch(() => undefined);
  }, remaining);
  return () => {
    markStale();
    window.clearTimeout(timeout);
  };
};

const useSyncPollingTimeout = (
  sync: GoogleCalendarSyncStatus | null | undefined,
  refetch: GoogleCalendarRefetch,
  setSyncPollingTimedOut: (timedOut: boolean) => void
) => {
  const status = sync?.status;
  const statusAt = sync?.statusAt ?? null;
  useEffect(
    () => startSyncPollingTimeout(status, statusAt, refetch, setSyncPollingTimedOut),
    [refetch, setSyncPollingTimedOut, status, statusAt]
  );
};

const refreshStudyActivityAfterSuccessfulSync = (queryClient: QueryClient) => {
  if (!pendingStudyActivityRefreshes.has(queryClient)) return;
  pendingStudyActivityRefreshes.delete(queryClient);
  queryClient.invalidateQueries({ queryKey: studyActivityKeys.all }).catch(() => undefined);
};

const refreshStudyActivityAfterSync = (
  queryClient: QueryClient,
  status: GoogleCalendarSyncStatus['status'] | undefined
) => {
  if (isActiveSync(status)) {
    pendingStudyActivityRefreshes.add(queryClient);
    return;
  }
  if (status === 'succeeded') {
    refreshStudyActivityAfterSuccessfulSync(queryClient);
    return;
  }
  if (status === 'failed') pendingStudyActivityRefreshes.delete(queryClient);
};

const useStudyActivityRefreshAfterSync = (
  queryClient: QueryClient,
  sync: GoogleCalendarSyncStatus | null | undefined
) => {
  const status = sync?.status;
  const statusAt = sync?.statusAt;
  useEffect(() => {
    refreshStudyActivityAfterSync(queryClient, status);
  }, [queryClient, status, statusAt]);
};

export function useGoogleCalendarConnection() {
  const queryClient = useQueryClient();
  const [syncPollingTimedOut, setSyncPollingTimedOut] = useState(false);
  const query = useQuery({
    queryKey: googleCalendarConnectionKey,
    queryFn: async () =>
      decodeGoogleCalendarConnectionStatus(await googleCalendarRequest<unknown>()),
    refetchInterval: (current) =>
      googleCalendarSyncPollInterval(current.state.data?.sync?.status, syncPollingTimedOut),
  });

  const sync = query.data?.sync;
  useSyncPollingTimeout(sync, query.refetch, setSyncPollingTimedOut);
  useStudyActivityRefreshAfterSync(queryClient, sync);

  return { ...query, syncPollingTimedOut };
}

export function useGoogleCalendars(enabled = true) {
  return useQuery({
    queryKey: googleCalendarKeys.calendars(),
    queryFn: () => googleCalendarRequest<GoogleCalendarList>('/calendars'),
    enabled,
  });
}

export function useSaveGoogleCalendarSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: GoogleCalendarSettings) => {
      const result = canonicalizeGoogleCalendarSettings(draft);
      if (!result.settings) {
        throw new GoogleCalendarRequestError('validation', null, result.errors);
      }
      return googleCalendarRequest<GoogleCalendarSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(result.settings),
      });
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData<GoogleCalendarConnectionStatus>(
        googleCalendarConnectionKey,
        (current) => (current ? { ...current, settings } : current)
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: googleCalendarConnectionKey }),
        queryClient.invalidateQueries({ queryKey: googleCalendarKeys.calendars() }),
      ]);
    },
  });
}

export function usePreviewGoogleCalendarEvents() {
  return useMutation({
    mutationFn: (criteria: GoogleCalendarPreviewCriteria) => {
      const result = canonicalizeGoogleCalendarSettings({ ...criteria, syncEnabled: false });
      if (!result.settings) {
        throw new GoogleCalendarRequestError('validation', null, result.errors);
      }
      return googleCalendarRequest<GoogleCalendarPreview>('/preview', {
        method: 'POST',
        body: JSON.stringify({
          calendarIds: result.settings.calendarIds,
          titleMatchTerms: result.settings.titleMatchTerms,
        }),
      });
    },
  });
}

export function useSyncGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: () => {
      pendingStudyActivityRefreshes.add(queryClient);
    },
    mutationFn: () =>
      googleCalendarRequest<GoogleCalendarConnectionStatus>('/sync', { method: 'POST' }),
    onSuccess: (connection) => {
      queryClient.setQueryData(googleCalendarConnectionKey, connection);
    },
    onError: async () => {
      try {
        await queryClient.refetchQueries(
          { queryKey: googleCalendarConnectionKey, type: 'all' },
          { throwOnError: true }
        );
      } catch {
        return;
      }
      const status = queryClient.getQueryData<GoogleCalendarConnectionStatus>(
        googleCalendarConnectionKey
      )?.sync?.status;
      if (status !== 'succeeded' && !isActiveSync(status)) {
        pendingStudyActivityRefreshes.delete(queryClient);
      }
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => googleCalendarRequest<void>('', { method: 'DELETE' }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: googleCalendarKeys.all });
      await queryClient.refetchQueries({ queryKey: googleCalendarConnectionKey, type: 'active' });
    },
  });
}
