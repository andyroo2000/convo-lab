import { requestJson } from '../../lib/apiClient';
import { fetchWithCsrf } from '../../lib/csrf';
import { notifyAuthSessionExpired } from '../../lib/authSession';

export interface JournalVoice {
  id: string;
  name: string;
}
export const getJournalVoices = () => requestJson<{ data: JournalVoice[] }>('/api/journal/voices');

interface AudioRequest {
  entryId: string;
  analysisId: string;
  voiceId: string;
  signal: AbortSignal;
}

export async function getJournalAudio({ entryId, analysisId, voiceId, signal }: AudioRequest) {
  const response = await fetchWithCsrf(
    `/api/journal/entries/${encodeURIComponent(entryId)}/audio`,
    {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId, voiceId }),
    }
  );
  notifyAuthSessionExpired(response);
  if (!response.ok) throw new Error('Audio could not be prepared. Please try again.');
  return response.blob();
}
