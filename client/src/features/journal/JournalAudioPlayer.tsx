import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { getJournalAudio, getJournalVoices, type JournalVoice } from './journalAudio';

interface AudioProps {
  ownerId: string;
  entryId: string;
  analysisId: string;
  expectedReplyRevision?: number;
}

function selectVoice(voices: JournalVoice[], preferred: string) {
  const selected = voices.find((voice) => voice.id === preferred);
  return selected?.id ?? voices[0]?.id ?? '';
}

const JournalAudioPlayer = ({
  ownerId,
  entryId,
  analysisId,
  expectedReplyRevision = 0,
}: AudioProps) => {
  const voices = useQuery({
    queryKey: ['journal-voices', ownerId],
    queryFn: getJournalVoices,
    staleTime: Infinity,
  });
  const [voice, setVoice] = useState('fishaudio:abb4362e736f40b7b5716f4fafcafa9f');
  const voiceId = selectVoice(voices.data?.data ?? [], voice);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>();
  const player = useRef<HTMLAudioElement>(null);

  useEffect(
    () => () => {
      request.current?.abort();
    },
    []
  );
  useEffect(() => {
    if (url) player.current?.play().catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function prepare() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const blob = await getJournalAudio({
        entryId,
        analysisId,
        expectedReplyRevision,
        voiceId,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setUrl(URL.createObjectURL(blob));
    } catch {
      if (!controller.signal.aborted) setError('Audio could not be prepared. Try again.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function changeVoice(value: string) {
    request.current?.abort();
    player.current?.pause();
    setVoice(value);
    setUrl('');
    setBusy(false);
    setError('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-2">
        {url ? (
          <audio
            ref={player}
            controls
            src={url}
            aria-label="Corrected version audio"
            className="h-10 min-w-0 flex-1"
          />
        ) : (
          <button
            type="button"
            aria-label="Play corrected version"
            disabled={busy || !voiceId}
            onClick={() => {
              prepare().catch(() => undefined);
            }}
            className="flex h-10 flex-1 items-center gap-3 rounded-lg px-3 text-sm text-navy disabled:opacity-50"
          >
            <Play size={18} aria-hidden="true" />
            {busy ? 'Preparing audio…' : '0:00'}
            <span className="h-1 flex-1 rounded bg-gray-200" />
          </button>
        )}
        <select
          aria-label="Narration voice"
          className="max-w-44 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
          value={voiceId}
          onChange={(event) => changeVoice(event.target.value)}
          disabled={!voices.data}
        >
          {voices.data?.data.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {voices.error && (
        <p role="alert" className="text-sm text-rose-700">
          Could not load voices.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              voices.refetch().catch(() => undefined);
            }}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
};

export default JournalAudioPlayer;
