import type { KeyboardEvent, MutableRefObject } from 'react';
import { getTtsVoiceById } from '@languageflow/shared/src/voiceSelection';

import { isSentenceActive } from '../../lib/playbackTiming';
import type { AudioSpeed, Episode, Sentence, Speaker } from '../../types';
import JapaneseText from '../JapaneseText';

interface PlaybackDialogueProps {
  avatarUrlMap: Map<string, string>;
  currentTime: number;
  episode: Episode;
  handleSentenceKeyDown: (event: KeyboardEvent, sentence: Sentence) => void;
  seekToSentence: (sentence: Sentence) => void;
  selectedSpeed: AudioSpeed;
  sentenceRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  showReadings: boolean;
  showTranslations: boolean;
}

interface PlaybackSentenceProps {
  avatarUrlMap: Map<string, string>;
  currentTime: number;
  episode: Episode;
  handleSentenceKeyDown: (event: KeyboardEvent, sentence: Sentence) => void;
  seekToSentence: (sentence: Sentence) => void;
  selectedSpeed: AudioSpeed;
  sentence: Sentence;
  sentenceRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  showReadings: boolean;
  showTranslations: boolean;
  speaker: Speaker;
  speakerIndex: number;
}

function getSpeakerAvatarUrl(
  avatarUrlMap: Map<string, string>,
  speaker: Speaker,
  targetLanguage: string,
  speakerIndex: number
): string {
  // Use all known voices here so existing episodes with hidden legacy voices still get avatars.
  const voiceInfo = getTtsVoiceById(targetLanguage, speaker.voiceId);
  const gender = voiceInfo?.gender || 'male';
  const avatarNumber = (speakerIndex % 3) + 1;
  const filename = `${targetLanguage}-${gender}-${avatarNumber}.jpg`;

  return avatarUrlMap.get(filename) || '/placeholder-avatar.jpg';
}

const PlaybackSentence = ({
  avatarUrlMap,
  currentTime,
  episode,
  handleSentenceKeyDown,
  seekToSentence,
  selectedSpeed,
  sentence,
  sentenceRefs,
  showReadings,
  showTranslations,
  speaker,
  speakerIndex,
}: PlaybackSentenceProps) => {
  const isAltSpeaker = speakerIndex % 2 !== 0;
  const isCurrentlySpeaking = isSentenceActive(sentence, selectedSpeed, currentTime * 1000);
  const borderTone = isAltSpeaker ? 'rgba(20, 141, 189, 0.72)' : 'rgba(17, 51, 92, 0.58)';

  return (
    <div
      ref={(element) => {
        if (element) sentenceRefs.current.set(sentence.id, element);
        else sentenceRefs.current.delete(sentence.id);
      }}
      className={`retro-dialog-row retro-playback-v3-row cursor-pointer ${isCurrentlySpeaking ? 'is-active' : ''}`}
      style={{ borderLeft: `4px solid ${borderTone}` }}
      onClick={() => seekToSentence(sentence)}
      onKeyDown={(event) => handleSentenceKeyDown(event, sentence)}
      role="button"
      tabIndex={0}
      data-testid={`playback-sentence-${sentence.id}`}
    >
      <div
        className={`retro-speaker-pane retro-playback-v3-speaker-pane ${isAltSpeaker ? 'alt' : ''} p-4 sm:p-5 flex flex-col items-center justify-center`}
      >
        <div className="retro-playback-v3-avatar w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md bg-[#f6f2df] border-2 border-[#f6f2df]">
          <img
            src={
              speaker.avatarUrl ||
              getSpeakerAvatarUrl(avatarUrlMap, speaker, episode.targetLanguage, speakerIndex)
            }
            alt={speaker.name}
            className="w-full h-full object-cover"
            onError={(event) => {
              const image = event.currentTarget;
              image.src = '/placeholder-avatar.jpg';
            }}
          />
        </div>
      </div>

      <div className="retro-playback-v3-content grid gap-3 p-4 sm:p-5 grid-cols-1">
        <div>
          <p className="text-[1.55rem] sm:text-[2rem] text-[rgba(20,50,86,0.92)] leading-[1.25] font-black">
            {episode.targetLanguage === 'ja' ? (
              <JapaneseText
                text={sentence.text}
                metadata={sentence.metadata}
                showFurigana={showReadings}
                className="playback-dialog-japanese !text-[1.55rem] sm:!text-[2rem] font-black leading-[1.25]"
              />
            ) : (
              <span className="text-[1.55rem] sm:text-[2rem]">{sentence.text}</span>
            )}
          </p>
        </div>

        {showTranslations && (
          <div>
            <p className="text-[0.95rem] sm:text-[1.1rem] text-[rgba(20,50,86,0.72)] italic leading-[1.35]">
              {sentence.translation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const PlaybackDialogue = ({
  avatarUrlMap,
  currentTime,
  episode,
  handleSentenceKeyDown,
  seekToSentence,
  selectedSpeed,
  sentenceRefs,
  showReadings,
  showTranslations,
}: PlaybackDialogueProps) => {
  const speakers = episode.dialogue?.speakers ?? [];
  const speakerMap = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  const speakerIndexMap = new Map(speakers.map((speaker, index) => [speaker.id, index]));
  const sentences = episode.dialogue?.sentences ?? [];

  return (
    <div className="space-y-4 pb-4">
      {sentences.map((sentence) => {
        const speaker = speakerMap.get(sentence.speakerId);
        if (!speaker) return null;

        return (
          <PlaybackSentence
            key={sentence.id}
            avatarUrlMap={avatarUrlMap}
            currentTime={currentTime}
            episode={episode}
            handleSentenceKeyDown={handleSentenceKeyDown}
            seekToSentence={seekToSentence}
            selectedSpeed={selectedSpeed}
            sentence={sentence}
            sentenceRefs={sentenceRefs}
            showReadings={showReadings}
            showTranslations={showTranslations}
            speaker={speaker}
            speakerIndex={speakerIndexMap.get(sentence.speakerId) ?? 0}
          />
        );
      })}
    </div>
  );
};

export default PlaybackDialogue;
