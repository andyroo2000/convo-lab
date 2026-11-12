import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { getJournalAudio } from './journalAudio';
import useJournalVoice, { type JournalAudioProps } from './useJournalVoice';

const JournalAudioSession = ({
  ownerId,
  entryId,
  analysisId,
  expectedReplyRevision = 0,
}: JournalAudioProps) => {
  const voice = useJournalVoice({ ownerId, entryId, analysisId, expectedReplyRevision });
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
    if (!voice.ready) return;
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
        voiceId: voice.voiceId,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setUrl(URL.createObjectURL(blob));
        voice.refreshAfterAudio();
      }
    } catch {
      if (!controller.signal.aborted) setError('Audio could not be prepared. Try again.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function changeVoice(value: string) {
    request.current?.abort();
    player.current?.pause();
    voice.choose(value);
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
            disabled={busy || !voice.ready}
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
          value={voice.voiceId}
          onChange={(event) => changeVoice(event.target.value)}
          disabled={voice.loading || voice.error}
        >
          {!voice.voiceId && (
            <option value="" disabled>
              Select voice
            </option>
          )}
          {voice.voices.map((item) => (
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
      {voice.loading && (
        <p role="status" className="text-sm text-gray-500">
          Loading saved voice…
        </p>
      )}
      {voice.error && (
        <p role="alert" className="text-sm text-rose-700">
          Could not load your saved voice.{' '}
          <button type="button" className="underline" onClick={voice.retry}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
};

const JournalAudioPlayer = ({
  ownerId,
  entryId,
  analysisId,
  expectedReplyRevision = 0,
}: JournalAudioProps) => (
  <JournalAudioSession
    key={`${ownerId}:${entryId}:${analysisId}:${expectedReplyRevision}`}
    ownerId={ownerId}
    entryId={entryId}
    analysisId={analysisId}
    expectedReplyRevision={expectedReplyRevision}
  />
);

export default JournalAudioPlayer;
