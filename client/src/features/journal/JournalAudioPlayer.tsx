import JournalVoicePicker from './JournalVoicePicker';
import JournalMinimalPlayer from './JournalMinimalPlayer';
import { JournalPlaybackBoundary } from './JournalPlaybackContext';
import { timedEntryAudio } from './journalTimedAudio';
import useJournalVoice, { type JournalAudioProps } from './useJournalVoice';

const JournalAudioSession = (props: JournalAudioProps) => {
  const voice = useJournalVoice(props);
  const { entryId, analysisId, expectedReplyRevision = 0 } = props;
  return (
    <div className="space-y-2">
      <JournalMinimalPlayer
        key={voice.voiceId}
        label="corrected version"
        disabled={!voice.ready}
        load={async (signal) => {
          const result = await timedEntryAudio(
            entryId,
            {
              analysisId,
              voiceId: voice.voiceId,
              expectedReplyRevision,
            },
            signal
          );
          if (!signal.aborted) voice.refreshAfterAudio();
          return result;
        }}
      />
      <div className="flex justify-end">
        <JournalVoicePicker
          voices={voice.voices}
          selected={voice.voiceId}
          disabled={voice.loading || voice.error}
          onChoose={voice.choose}
        />
      </div>
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
  <JournalPlaybackBoundary>
    <JournalAudioSession
      key={`${ownerId}:${entryId}:${analysisId}:${expectedReplyRevision}`}
      ownerId={ownerId}
      entryId={entryId}
      analysisId={analysisId}
      expectedReplyRevision={expectedReplyRevision}
    />
  </JournalPlaybackBoundary>
);
export default JournalAudioPlayer;
