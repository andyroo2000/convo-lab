import JournalVoicePicker from './JournalVoicePicker';
import JournalInlinePlayer from './JournalInlinePlayer';
import { JournalPlaybackBoundary } from './JournalPlaybackContext';
import { timedEntryAudio } from './journalTimedAudio';
import useJournalVoice, { type JournalAudioProps } from './useJournalVoice';

type Props = JournalAudioProps & {
  toolbarTarget?: HTMLElement | null;
  listenTarget?: HTMLElement | null;
};

const JournalAudioSession = (props: Props & { voice: ReturnType<typeof useJournalVoice> }) => {
  const { voice } = props;
  const { entryId, analysisId, expectedReplyRevision = 0, toolbarTarget, listenTarget } = props;
  return (
    <div className={toolbarTarget ? undefined : 'space-y-2'}>
      <JournalVoicePicker
        toolbarTarget={toolbarTarget}
        voices={voice.voices}
        selected={voice.voiceId}
        disabled={voice.loading || voice.error}
        onChoose={voice.choose}
      />
      <JournalInlinePlayer
        key={voice.voiceId}
        target={listenTarget}
        label="corrected version"
        compact
        avatar={voice.voices.find((item) => item.id === voice.voiceId)?.avatarUrl}
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
// Keep preferences mounted across version switches; only the playback session ends.
const JournalAudioSettings = (props: Props & { active: boolean }) => {
  const voice = useJournalVoice(props);
  const { active } = props;
  return active ? <JournalAudioSession {...props} voice={voice} /> : null;
};
const JournalAudioPlayer = ({ active = true, ...props }: Props & { active?: boolean }) => (
  <JournalPlaybackBoundary>
    <JournalAudioSettings
      key={`${props.ownerId}:${props.entryId}:${props.analysisId}:${props.expectedReplyRevision ?? 0}`}
      {...props}
      active={active}
    />
  </JournalPlaybackBoundary>
);
export default JournalAudioPlayer;
