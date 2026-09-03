import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import useWarmAudioCache from '../hooks/useWarmAudioCache';
import { useSpeakerAvatars } from '../hooks/useSpeakerAvatars';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import usePlaybackEpisode from '../hooks/usePlaybackEpisode';
import usePlaybackAudioGeneration from '../hooks/usePlaybackAudioGeneration';
import usePlaybackKeyboardControls from '../hooks/usePlaybackKeyboardControls';
import usePlaybackDialogueNavigation from '../hooks/usePlaybackDialogueNavigation';
import { Sentence, AudioSpeed, Episode } from '../types';
import AudioScriptPlayback from '../components/audio/AudioScriptPlayback';
import PlaybackDialogue from '../components/playback/PlaybackDialogue';
import PlaybackHeader from '../components/playback/PlaybackHeader';
import Toast from '../components/common/Toast';

const EMPTY_SENTENCES: Sentence[] = [];

const getViewAsUserId = (searchParams: URLSearchParams) => searchParams.get('viewAs') || undefined;

const getPlaybackRouteIdentity = (episodeId?: string, viewAsUserId?: string) =>
  `${episodeId ?? ''}\0${viewAsUserId ?? ''}`;

const usePlaybackAudioUrls = (episode: Episode | null) =>
  useMemo(
    () => [episode?.audioUrl_0_7, episode?.audioUrl_0_85, episode?.audioUrl_1_0, episode?.audioUrl],
    [episode?.audioUrl_0_7, episode?.audioUrl_0_85, episode?.audioUrl_1_0, episode?.audioUrl]
  );

const shouldWarmPlaybackAudio = (episode: Episode | null, isGeneratingAudio: boolean) =>
  Boolean(episode && !isGeneratingAudio);

const canNavigatePlaybackDialogue = (episode: Episode | null) =>
  Boolean(episode && episode.contentType !== 'script');

const getPlaybackSentences = (episode: Episode | null) =>
  episode?.dialogue?.sentences ?? EMPTY_SENTENCES;

const getToastMessage = (message: string | null) => message || '';

const PlaybackLoadingState = () => (
  <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
    <div className="card text-center py-12">
      <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-600">Loading episode...</p>
    </div>
  </div>
);

const PlaybackMissingState = () => (
  <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
    <div className="card text-center py-12">
      <p className="text-gray-600">Episode not found</p>
    </div>
  </div>
);

const PlaybackPage = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const viewAsUserId = getViewAsUserId(searchParams);
  const {
    getEpisode,
    generateAudio: _generateAudio,
    generateAllSpeedsAudio,
    pollJobStatus: _pollJobStatus,
  } = useEpisodes();
  const { isFeatureEnabled } = useFeatureFlags();
  const { audioRef, currentTime, isPlaying, seek, play, pause } = useAudioPlayer();
  const { avatarUrlMap } = useSpeakerAvatars();
  const { episode, isEpisodeLoading, loadEpisode } = usePlaybackEpisode({
    episodeId,
    viewAsUserId,
    getEpisode,
  });
  const [selectedSpeed, setSelectedSpeed] = useState<AudioSpeed>('medium');
  const [showReadings, setShowReadings] = useState(false); // Hide furigana by default
  const [showTranslations, setShowTranslations] = useState(true); // Show English translations by default
  const {
    isGeneratingAudio,
    isRefreshingEpisode,
    needsEpisodeRefresh,
    generationProgress,
    toastMessage,
    toastType,
    generateAllSpeeds,
    retryEpisodeRefresh,
    clearToast,
  } = usePlaybackAudioGeneration({
    episodeId,
    routeIdentity: getPlaybackRouteIdentity(episodeId, viewAsUserId),
    episode,
    generateAllSpeedsAudio,
    loadEpisode,
  });
  const audioCourseEnabled = isFeatureEnabled('audioCourseEnabled');
  const episodeAudioUrls = usePlaybackAudioUrls(episode);

  useWarmAudioCache(episodeAudioUrls, shouldWarmPlaybackAudio(episode, isGeneratingAudio));

  const { navigateSentence } = usePlaybackKeyboardControls({
    currentTimeSeconds: currentTime,
    enabled: canNavigatePlaybackDialogue(episode),
    isPlaying,
    pause,
    play,
    seek,
    selectedSpeed,
    sentences: getPlaybackSentences(episode),
  });

  const { handleSentenceKeyDown, seekToSentence, sentenceRefs } = usePlaybackDialogueNavigation({
    currentTime,
    episode,
    isPlaying,
    navigateSentence,
    play,
    seek,
    selectedSpeed,
  });

  if (isEpisodeLoading) {
    return <PlaybackLoadingState />;
  }

  if (!episode) {
    return <PlaybackMissingState />;
  }

  if (episode.contentType === 'script') {
    return <AudioScriptPlayback episode={episode} />;
  }

  return (
    <div
      className="retro-playback-v3-page w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-4"
      data-testid="playback-page-container"
    >
      <PlaybackHeader
        audioCourseEnabled={audioCourseEnabled}
        audioRef={audioRef}
        episode={episode}
        generateAllSpeeds={generateAllSpeeds}
        generationProgress={generationProgress}
        isGeneratingAudio={isGeneratingAudio}
        isRefreshingEpisode={isRefreshingEpisode}
        needsEpisodeRefresh={needsEpisodeRefresh}
        retryEpisodeRefresh={retryEpisodeRefresh}
        selectedSpeed={selectedSpeed}
        setSelectedSpeed={setSelectedSpeed}
        setShowReadings={setShowReadings}
        setShowTranslations={setShowTranslations}
        showReadings={showReadings}
        showTranslations={showTranslations}
        viewAsUserId={viewAsUserId}
      />

      <PlaybackDialogue
        avatarUrlMap={avatarUrlMap}
        currentTime={currentTime}
        episode={episode}
        handleSentenceKeyDown={handleSentenceKeyDown}
        seekToSentence={seekToSentence}
        selectedSpeed={selectedSpeed}
        sentenceRefs={sentenceRefs}
        showReadings={showReadings}
        showTranslations={showTranslations}
      />

      {/* Toast Notification */}
      <Toast
        message={getToastMessage(toastMessage)}
        type={toastType}
        isVisible={!!toastMessage}
        onClose={clearToast}
      />
    </div>
  );
};

export default PlaybackPage;
