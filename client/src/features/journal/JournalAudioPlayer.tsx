import JournalVoicePicker from './JournalVoicePicker';
import JournalMinimalPlayer from './JournalMinimalPlayer';
import { JournalPlaybackBoundary } from './JournalPlaybackContext';
import { timedEntryAudio } from './journalTimedAudio';
import useJournalVoice, { type JournalAudioProps } from './useJournalVoice';

type Props = JournalAudioProps & { toolbarTarget?: HTMLElement | null };

const JournalAudioSession = (props: Props) => {
  const voice = useJournalVoice(props);
  const { entryId, analysisId, expectedReplyRevision = 0, toolbarTarget } = props;
  return (
    <div className="space-y-2">
      <JournalVoicePicker
        toolbarTarget={toolbarTarget}
        voices={voice.voices}
        selected={voice.voiceId}
        disabled={voice.loading || voice.error}
        onChoose={voice.choose}
      />
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
  toolbarTarget,
}: Props) => (
  <JournalPlaybackBoundary>
    <JournalAudioSession
      key={`${ownerId}:${entryId}:${analysisId}:${expectedReplyRevision}`}
      toolbarTarget={toolbarTarget}
      ownerId={ownerId}
      entryId={entryId}
      analysisId={analysisId}
      expectedReplyRevision={expectedReplyRevision}
    />
  </JournalPlaybackBoundary>
);
export default JournalAudioPlayer;
