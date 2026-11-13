import { useEffect, useRef, useState } from 'react';
import { claimJournalAudio, isCurrentJournalAudio } from './journalAudioIntent';
import { recordingBlob, type TimedRecording } from './journalTimedAudio';

export type RecordingLoader = (signal: AbortSignal) => Promise<{ data: TimedRecording }>;
export default function useTimedRecording(load: RecordingLoader) {
  const [recording, setRecording] = useState<{
    url: string;
    data: TimedRecording;
    intent: number;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>();
  useEffect(
    () => () => {
      request.current?.abort();
    },
    []
  );
  useEffect(
    () => () => {
      if (recording) URL.revokeObjectURL(recording.url);
    },
    [recording]
  );
  async function prepare() {
    if (request.current) return;
    const controller = new AbortController();
    const intent = claimJournalAudio();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const { data } = await load(controller.signal);
      if (!controller.signal.aborted && isCurrentJournalAudio(intent))
        setRecording({ url: URL.createObjectURL(recordingBlob(data)), data, intent });
    } catch {
      if (!controller.signal.aborted) setError('Audio could not be prepared. Try again.');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        request.current = undefined;
      }
    }
  }
  return { recording, busy, error, setError, prepare };
}
