import { useEffect, useState } from 'react';
import { fetchWithCsrf } from '../../lib/csrf';
import { notifyAuthSessionExpired } from '../../lib/authSession';

export default function useQuestionRecording(
  entryId: string,
  questionId: string,
  ready: boolean,
  retry: number
) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setUrl('');
    setError('');
    if (!ready) return undefined;
    const controller = new AbortController();
    let objectUrl = '';
    async function load() {
      try {
        const response = await fetchWithCsrf(
          `/api/journal/entries/${encodeURIComponent(entryId)}/questions/${encodeURIComponent(questionId)}/audio`,
          {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
            headers: { Accept: 'audio/mpeg' },
          }
        );
        notifyAuthSessionExpired(response);
        if (!response.ok) throw new Error('Audio could not be loaded.');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setError('Audio could not be loaded.');
      }
    }
    load().catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entryId, questionId, ready, retry]);
  return { url, error };
}
