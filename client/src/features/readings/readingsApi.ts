import { requestJson } from '../../lib/apiClient';
import { fetchWithCsrf } from '../../lib/csrf';
import { notifyAuthSessionExpired } from '../../lib/authSession';
import type { ReadingDetail, ReadingSummary } from './types';

const base = '/api/convolab/readings';

export const listReadings = (signal?: AbortSignal) =>
  requestJson<ReadingSummary[]>(base, { signal });

export const getReading = (id: string, signal?: AbortSignal) =>
  requestJson<ReadingDetail>(`${base}/${encodeURIComponent(id)}`, { signal });

export async function getReadingAudio(id: string, sentence: number, signal: AbortSignal) {
  const response = await fetchWithCsrf(
    `${base}/${encodeURIComponent(id)}/sentences/${sentence}/audio`,
    { method: 'POST', credentials: 'include', signal, headers: { Accept: 'audio/mpeg' } }
  );
  notifyAuthSessionExpired(response);
  if (!response.ok) throw new Error('Sato audio could not be prepared. Please try again.');
  return response.blob();
}
