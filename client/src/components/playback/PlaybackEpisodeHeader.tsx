import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';

import type { AudioSpeed, Episode } from '../../types';
import SpeedSelector from '../common/SpeedSelector';
import ViewToggleButtons from '../common/ViewToggleButtons';

interface PlaybackEpisodeHeaderProps {
  audioCourseEnabled: boolean;
  currentAudioUrl?: string;
  episode: Episode;
  isGeneratingAudio: boolean;
  selectedSpeed: AudioSpeed;
  setSelectedSpeed: Dispatch<SetStateAction<AudioSpeed>>;
  setShowReadings: Dispatch<SetStateAction<boolean>>;
  setShowTranslations: Dispatch<SetStateAction<boolean>>;
  showReadings: boolean;
  showTranslations: boolean;
  viewAsUserId?: string;
}

const PracticeLink = ({ episode }: { episode: Episode }) => {
  if (!(episode.dialogue?.sentences ?? []).length) return null;

  return (
    <Link to={`/app/practice/${episode.id}`} className="btn-primary">
      Practice speaking
    </Link>
  );
};

const PlaybackViewControls = ({
  currentAudioUrl,
  episode,
  isGeneratingAudio,
  selectedSpeed,
  setSelectedSpeed,
  setShowReadings,
  setShowTranslations,
  showReadings,
  showTranslations,
}: Omit<PlaybackEpisodeHeaderProps, 'audioCourseEnabled' | 'viewAsUserId'>) => {
  if (isGeneratingAudio || !currentAudioUrl) return null;

  return (
    <>
      {episode.targetLanguage === 'ja' && (
        <ViewToggleButtons
          showReadings={showReadings}
          showTranslations={showTranslations}
          onToggleReadings={() => setShowReadings(!showReadings)}
          onToggleTranslations={() => setShowTranslations(!showTranslations)}
          readingsLabel="Furigana"
        />
      )}
      <SpeedSelector
        selectedSpeed={selectedSpeed}
        onSpeedChange={(speed) => setSelectedSpeed(speed as AudioSpeed)}
        showLabels
      />
    </>
  );
};

const AudioCourseLink = ({
  audioCourseEnabled,
  episode,
  viewAsUserId,
}: Pick<PlaybackEpisodeHeaderProps, 'audioCourseEnabled' | 'episode' | 'viewAsUserId'>) => {
  if (!audioCourseEnabled || episode.courseEpisodes?.length) return null;

  const audioCourseUrl = viewAsUserId
    ? `/app/create/audio-course/${episode.id}?viewAs=${viewAsUserId}`
    : `/app/create/audio-course/${episode.id}`;
  return (
    <Link to={audioCourseUrl} className="btn-outline text-sm px-3 py-2">
      Convert to Audio Course
    </Link>
  );
};

const PlaybackEpisodeHeader = ({
  audioCourseEnabled,
  currentAudioUrl,
  episode,
  isGeneratingAudio,
  selectedSpeed,
  setSelectedSpeed,
  setShowReadings,
  setShowTranslations,
  showReadings,
  showTranslations,
  viewAsUserId,
}: PlaybackEpisodeHeaderProps) => {
  const speakers = episode.dialogue?.speakers ?? [];

  return (
    <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1">
            <h1 className="retro-headline text-3xl sm:text-6xl mb-2">{episode.title}</h1>
            <div className="inline-flex items-center gap-3 retro-caps text-[rgba(20,50,86,0.92)] text-base sm:text-xl">
              <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold">
                {speakers[0]?.proficiency}
              </div>
              <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold capitalize">
                {speakers[0]?.tone}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-6">
            <PracticeLink episode={episode} />
            <PlaybackViewControls
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
            <AudioCourseLink
              audioCourseEnabled={audioCourseEnabled}
              episode={episode}
              viewAsUserId={viewAsUserId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaybackEpisodeHeader;
