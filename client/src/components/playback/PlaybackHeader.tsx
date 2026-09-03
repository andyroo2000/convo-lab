import type { Dispatch, SetStateAction } from 'react';

import type { AudioSpeed, Episode } from '../../types';
import PlaybackAudioStatus from './PlaybackAudioStatus';
import PlaybackEpisodeHeader from './PlaybackEpisodeHeader';

interface PlaybackHeaderProps {
  audioCourseEnabled: boolean;
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
  viewAsUserId?: string;
}

function getCurrentAudioUrl(episode: Episode, selectedSpeed: AudioSpeed): string | undefined {
  const hasAllSpeeds = [episode.audioUrl_0_7, episode.audioUrl_0_85, episode.audioUrl_1_0].every(
    Boolean
  );
  if (!hasAllSpeeds) return episode.audioUrl;

  const audioUrlBySpeed: Record<AudioSpeed, string | undefined> = {
    slow: episode.audioUrl_0_7,
    medium: episode.audioUrl_0_85,
    normal: episode.audioUrl_1_0,
  };
  return audioUrlBySpeed[selectedSpeed];
}

const PlaybackHeader = ({
  audioCourseEnabled,
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
  viewAsUserId,
}: PlaybackHeaderProps) => {
  const currentAudioUrl = getCurrentAudioUrl(episode, selectedSpeed);

  return (
    <div
      className="sticky top-[4.5rem] z-10 bg-[rgba(251,245,224,0.98)] mb-3"
      data-playback-sticky-header
    >
      <PlaybackEpisodeHeader
        audioCourseEnabled={audioCourseEnabled}
        currentAudioUrl={currentAudioUrl}
        episode={episode}
        isGeneratingAudio={isGeneratingAudio}
        selectedSpeed={selectedSpeed}
        setSelectedSpeed={setSelectedSpeed}
        setShowReadings={setShowReadings}
        setShowTranslations={setShowTranslations}
        showReadings={showReadings}
        showTranslations={showTranslations}
        viewAsUserId={viewAsUserId}
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
