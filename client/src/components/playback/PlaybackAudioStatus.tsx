import { hasAllPlaybackSpeeds } from '../../lib/playbackAudio';
import type { Episode } from '../../types';
import AudioPlayer from '../AudioPlayer';

interface PlaybackAudioStatusProps {
  audioRef: (element: HTMLAudioElement | null) => void;
  currentAudioUrl?: string;
  episode: Episode;
  generateAllSpeeds: () => void;
  generationProgress: number;
  isGeneratingAudio: boolean;
  isRefreshingEpisode: boolean;
  needsEpisodeRefresh: boolean;
  retryEpisodeRefresh: () => void;
}

interface AudioGenerationPromptProps {
  generateAllSpeeds: () => void;
  hasAnyAudio: boolean;
  isRefreshingEpisode: boolean;
  needsEpisodeRefresh: boolean;
  retryEpisodeRefresh: () => void;
  shouldAutoGenerate: boolean;
}

function getAudioAvailabilityTitle(hasAnyAudio: boolean): string {
  return hasAnyAudio ? 'More audio speeds are available.' : 'Audio isn’t generated yet.';
}

function getAudioGenerationDescription(shouldAutoGenerate: boolean): string {
  return shouldAutoGenerate
    ? 'Generate audio to enable slow, medium, and normal playback.'
    : 'Auto-generation is off for this dialogue. Generate audio to enable playback.';
}

function getRefreshButtonLabel(isRefreshingEpisode: boolean): string {
  return isRefreshingEpisode ? 'Refreshing...' : 'Retry refresh';
}

const GenerationProgress = ({ generationProgress }: { generationProgress: number }) => (
  <div className="retro-paper-panel bg-yellow border-x-2 border-b-2 border-[rgba(20,50,86,0.12)]">
    <div className="flex items-center gap-4 p-4">
      <div className="flex-shrink-0">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-periwinkle" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-dark-brown mb-1">
          Generating audio at all speeds...
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/30 rounded-full h-2 overflow-hidden">
            <div
              className="bg-strawberry h-2 transition-all duration-300 ease-out"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-periwinkle-dark min-w-[3rem] text-right">
            {generationProgress}%
          </span>
        </div>
      </div>
    </div>
  </div>
);

const AudioGenerationPrompt = ({
  generateAllSpeeds,
  hasAnyAudio,
  isRefreshingEpisode,
  needsEpisodeRefresh,
  retryEpisodeRefresh,
  shouldAutoGenerate,
}: AudioGenerationPromptProps) => {
  const title = needsEpisodeRefresh
    ? 'Audio finished generating, but playback needs to refresh.'
    : getAudioAvailabilityTitle(hasAnyAudio);
  const description = needsEpisodeRefresh
    ? 'Retry loading this episode without starting another audio job.'
    : getAudioGenerationDescription(shouldAutoGenerate);
  const buttonLabel = needsEpisodeRefresh
    ? getRefreshButtonLabel(isRefreshingEpisode)
    : 'Generate Audio';

  return (
    <div className="retro-paper-panel bg-yellow border-x-2 border-b-2 border-[rgba(20,50,86,0.12)]">
      <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-dark-brown">{title}</p>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={needsEpisodeRefresh ? retryEpisodeRefresh : generateAllSpeeds}
          disabled={isRefreshingEpisode}
          className="btn-secondary text-sm px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

const PlaybackAudioStatus = ({
  audioRef,
  currentAudioUrl,
  episode,
  generateAllSpeeds,
  generationProgress,
  isGeneratingAudio,
  isRefreshingEpisode,
  needsEpisodeRefresh,
  retryEpisodeRefresh,
}: PlaybackAudioStatusProps) => {
  const speedUrls = [episode.audioUrl_0_7, episode.audioUrl_0_85, episode.audioUrl_1_0];
  const hasAllSpeeds = hasAllPlaybackSpeeds(episode);
  const hasAnyAudio = [...speedUrls, episode.audioUrl].some(Boolean);

  return (
    <>
      {isGeneratingAudio && <GenerationProgress generationProgress={generationProgress} />}
      {!isGeneratingAudio && !hasAllSpeeds && (
        <AudioGenerationPrompt
          generateAllSpeeds={generateAllSpeeds}
          hasAnyAudio={hasAnyAudio}
          isRefreshingEpisode={isRefreshingEpisode}
          needsEpisodeRefresh={needsEpisodeRefresh}
          retryEpisodeRefresh={retryEpisodeRefresh}
          shouldAutoGenerate={episode.autoGenerateAudio !== false}
        />
      )}
      {!isGeneratingAudio && currentAudioUrl && (
        <div className="retro-paper-panel border-x-2 border-b-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 sm:px-5 py-3">
          <AudioPlayer src={currentAudioUrl} audioRef={audioRef} key={currentAudioUrl} />
        </div>
      )}
    </>
  );
};

export default PlaybackAudioStatus;
