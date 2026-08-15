import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';
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
}

export const googleCalendarKeys = {
  all: ['study', 'google-calendar'] as const,
  connection: () => [...googleCalendarKeys.all, 'connection'] as const,
  calendars: () => [...googleCalendarKeys.all, 'calendars'] as const,
};
export const googleCalendarConnectionKey = googleCalendarKeys.connection();
export const googleCalendarConnectPath = studyApiPath('/google-calendar/connect');

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
  request_failed: 'Unable to update the Google Calendar connection.',
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
  if (status === 409) return 'not_connected';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503) return 'unavailable';
  return 'request_failed';
}

async function googleCalendarRequest<T>(path = '', init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetchWithCsrf(studyApiPath(`/google-calendar${path}`), {
    ...init,
    credentials: 'include',
    headers,
  });
  notifyAuthSessionExpired(response);

  if (!response.ok) {
    throw new GoogleCalendarRequestError(errorKind(response.status), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function useGoogleCalendarConnection() {
  return useQuery({
    queryKey: googleCalendarConnectionKey,
    queryFn: () => googleCalendarRequest<GoogleCalendarConnectionStatus>(),
  });
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
