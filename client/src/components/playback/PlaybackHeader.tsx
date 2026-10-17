import type { Dispatch, SetStateAction } from 'react';

import { getPlaybackAudioUrl } from '../../lib/playbackAudio';
import type { AudioSpeed, Episode } from '../../types';
import PlaybackAudioStatus from './PlaybackAudioStatus';
import PlaybackEpisodeHeader from './PlaybackEpisodeHeader';

interface PlaybackHeaderProps {
  audioRef: (element: HTMLAudioElement | null) => void;
  episode: Episode;
  generateAllSpeeds: () => void;
  generationProgress: number;
  isGeneratingAudio: boolean;
  isRefreshingEpisode: boolean;
  needsEpisodeRefresh: boolean;
  retryEpisodeRefresh: () => void;
  selectedSpeed: AudioSpeed;
  setSelectedSpeed: Dispatch<SetStateAction<AudioSpeed>>;
  setShowReadings: Dispatch<SetStateAction<boolean>>;
  setShowTranslations: Dispatch<SetStateAction<boolean>>;
  showReadings: boolean;
  showTranslations: boolean;
}

const PlaybackHeader = ({
  audioRef,
  episode,
  generateAllSpeeds,
  generationProgress,
  isGeneratingAudio,
  isRefreshingEpisode,
  needsEpisodeRefresh,
  retryEpisodeRefresh,
  selectedSpeed,
  setSelectedSpeed,
  setShowReadings,
  setShowTranslations,
  showReadings,
  showTranslations,
}: PlaybackHeaderProps) => {
  const currentAudioUrl = getPlaybackAudioUrl(episode, selectedSpeed);

  return (
    <div
      className="sticky top-[4.5rem] z-10 bg-[rgba(251,245,224,0.98)] mb-3"
      data-playback-sticky-header
    >
      <PlaybackEpisodeHeader
        currentAudioUrl={currentAudioUrl}
        episode={episode}
        isGeneratingAudio={isGeneratingAudio}
        selectedSpeed={selectedSpeed}
        setSelectedSpeed={setSelectedSpeed}
        setShowReadings={setShowReadings}
        setShowTranslations={setShowTranslations}
        showReadings={showReadings}
        showTranslations={showTranslations}
      />
      <PlaybackAudioStatus
        audioRef={audioRef}
        currentAudioUrl={currentAudioUrl}
        episode={episode}
        generateAllSpeeds={generateAllSpeeds}
        generationProgress={generationProgress}
        isGeneratingAudio={isGeneratingAudio}
        isRefreshingEpisode={isRefreshingEpisode}
        needsEpisodeRefresh={needsEpisodeRefresh}
        retryEpisodeRefresh={retryEpisodeRefresh}
      />
    </div>
  );
};

export default PlaybackHeader;
