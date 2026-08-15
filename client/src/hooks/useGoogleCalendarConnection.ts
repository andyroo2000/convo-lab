import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyAuthSessionExpired } from '../lib/authSession';
import { fetchWithCsrf } from '../lib/csrf';
import { studyApiPath } from '../lib/studyApi';

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
  scopes: string[];
  settings: Record<string, unknown>;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export const googleCalendarConnectionKey = ['study', 'google-calendar-connection'] as const;
export const googleCalendarConnectPath = studyApiPath('/google-calendar/connect');

async function connectionRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetchWithCsrf(studyApiPath('/google-calendar'), {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init?.headers },
  });
  notifyAuthSessionExpired(response);

  if (!response.ok) {
    throw new Error('Unable to update the Google Calendar connection.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function useGoogleCalendarConnection() {
  return useQuery({
    queryKey: googleCalendarConnectionKey,
    queryFn: () => connectionRequest<GoogleCalendarConnectionStatus>(),
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => connectionRequest<void>({ method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: googleCalendarConnectionKey }),
  });
}
