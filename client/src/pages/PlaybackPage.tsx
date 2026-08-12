import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getTtsVoiceById } from '@languageflow/shared/src/voiceSelection';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import useWarmAudioCache from '../hooks/useWarmAudioCache';
import { useSpeakerAvatars } from '../hooks/useSpeakerAvatars';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import usePlaybackEpisode from '../hooks/usePlaybackEpisode';
import usePlaybackAudioGeneration from '../hooks/usePlaybackAudioGeneration';
import {
  getSentenceNavigationTargetMs,
  getSentenceTiming,
  isSentenceActive,
} from '../lib/playbackTiming';
import { Sentence, AudioSpeed, Speaker } from '../types';
import JapaneseText from '../components/JapaneseText';
import AudioPlayer from '../components/AudioPlayer';
import AudioScriptPlayback from '../components/audio/AudioScriptPlayback';
import Toast from '../components/common/Toast';
import SpeedSelector from '../components/common/SpeedSelector';
import ViewToggleButtons from '../components/common/ViewToggleButtons';

// Helper function to get avatar URL based on speaker voice and gender
function getSpeakerAvatarFilename(
  speaker: Speaker,
  targetLanguage: string,
  speakerIndex: number
): string {
  // Use all known voices here so existing episodes with hidden legacy voices still get avatars.
  const voiceInfo = getTtsVoiceById(targetLanguage, speaker.voiceId);
  const gender = voiceInfo?.gender || 'male'; // Fallback to male if not found

  // Map speaker index to avatar variant
  // For each gender, we have multiple avatars numbered 1, 2, 3, etc.
  const avatarNumber = (speakerIndex % 3) + 1; // Cycle through 1, 2, 3

  // Construct avatar filename: {language}-{gender}-{number}.jpg
  // e.g., "ja-male-1.jpg", "ja-female-2.jpg"
  return `${targetLanguage}-${gender}-${avatarNumber}.jpg`;
}

const PlaybackPage = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
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
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
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
    routeIdentity: `${episodeId ?? ''}\0${viewAsUserId ?? ''}`,
    episode,
    generateAllSpeedsAudio,
    loadEpisode,
  });
  const audioCourseEnabled = isFeatureEnabled('audioCourseEnabled');
  const episodeAudioUrls = useMemo(
    () => [episode?.audioUrl_0_7, episode?.audioUrl_0_85, episode?.audioUrl_1_0, episode?.audioUrl],
    [episode?.audioUrl_0_7, episode?.audioUrl_0_85, episode?.audioUrl_1_0, episode?.audioUrl]
  );

  useWarmAudioCache(episodeAudioUrls, Boolean(episode && !isGeneratingAudio));

  // Helper function to get speaker avatar URL from GCS
  const getSpeakerAvatarUrl = (
    speaker: Speaker,
    targetLanguage: string,
    speakerIndex: number
  ): string => {
    const filename = getSpeakerAvatarFilename(speaker, targetLanguage, speakerIndex);
    const url = avatarUrlMap.get(filename);

    // Return GCS URL if available, otherwise return a placeholder
    return url || '/placeholder-avatar.jpg';
  };

  // Keyboard controls: Space bar to play/pause, Arrow keys to navigate turns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Handle space bar for play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      // Handle arrow keys for turn navigation
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();

        if (!episode?.dialogue?.sentences || episode.dialogue.sentences.length === 0) return;

        const { sentences } = episode.dialogue;
        const currentTimeMs = currentTime * 1000;
        const targetTimeMs = getSentenceNavigationTargetMs(
          sentences,
          selectedSpeed,
          currentTimeMs,
          e.code === 'ArrowLeft' ? 'previous' : 'next'
        );

        if (targetTimeMs !== undefined) seek(targetTimeMs / 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, episode, currentTime, seek, selectedSpeed]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!episode?.dialogue?.sentences) return;

    const currentSentence = episode.dialogue.sentences.find((sentence) =>
      isSentenceActive(sentence, selectedSpeed, currentTime * 1000)
    );

    if (currentSentence) {
      const element = sentenceRefs.current.get(currentSentence.id);
      if (element) {
        // Calculate the actual height of the sticky header dynamically
        const stickyHeader = document.querySelector('[data-playback-sticky-header]');
        const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
        const nav = document.querySelector('.retro-topbar');
        const navHeight = nav ? nav.getBoundingClientRect().height : 72;
        const yOffset = -(navHeight + headerHeight + 20); // Add 20px padding
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }, [currentTime, episode, selectedSpeed]);

  const seekToSentence = (sentence: Sentence) => {
    const { startTime } = getSentenceTiming(sentence, selectedSpeed);

    if (startTime !== undefined) {
      // Convert milliseconds to seconds
      seek(startTime / 1000);
      // Play if not already playing
      if (!isPlaying) {
        play();
      }
    }
  };

  if (isEpisodeLoading) {
    return (
      <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
        <div className="card text-center py-12">
          <p className="text-gray-600">Episode not found</p>
        </div>
      </div>
    );
  }

  if (episode.contentType === 'script') {
    return <AudioScriptPlayback episode={episode} />;
  }

  const { dialogue } = episode;
  const speakers = dialogue?.speakers || [];
  const sentences = dialogue?.sentences || [];

  // Create speaker map for quick lookup
  const speakerMap = new Map(speakers.map((s) => [s.id, s]));

  // Create speaker index map for color assignment
  const speakerIndexMap = new Map(speakers.map((s, index) => [s.id, index]));

  const hasAudioCourse = Boolean(episode.courseEpisodes?.length);
  const hasAllSpeeds = Boolean(
    episode.audioUrl_0_7 && episode.audioUrl_0_85 && episode.audioUrl_1_0
  );
  const hasAnyAudio = Boolean(
    episode.audioUrl_0_7 || episode.audioUrl_0_85 || episode.audioUrl_1_0 || episode.audioUrl
  );
  const needsAudioGeneration = !hasAllSpeeds;
  const autoGenerationEnabled = episode.autoGenerateAudio !== false;
  let audioGenerationTitle = hasAnyAudio
    ? 'More audio speeds are available.'
    : 'Audio isn’t generated yet.';
  let audioGenerationDescription = autoGenerationEnabled
    ? 'Generate audio to enable slow, medium, and normal playback.'
    : 'Auto-generation is off for this dialogue. Generate audio to enable playback.';
  let audioGenerationButtonLabel = 'Generate Audio';

  if (needsEpisodeRefresh) {
    audioGenerationTitle = 'Audio finished generating, but playback needs to refresh.';
    audioGenerationDescription = 'Retry loading this episode without starting another audio job.';
    audioGenerationButtonLabel = isRefreshingEpisode ? 'Refreshing...' : 'Retry refresh';
  }

  // Get current audio URL based on selected speed
  /* eslint-disable no-nested-ternary */
  const currentAudioUrl = hasAllSpeeds
    ? selectedSpeed === 'slow'
      ? episode.audioUrl_0_7
      : selectedSpeed === 'medium'
        ? episode.audioUrl_0_85
        : episode.audioUrl_1_0
    : episode.audioUrl; // Fallback to legacy for old episodes
  /* eslint-enable no-nested-ternary */

  return (
    <div
      className="retro-playback-v3-page w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-4"
      data-testid="playback-page-container"
    >
      {/* Sticky Header Container (Header + Audio Player/Progress) */}
      <div
        className="sticky top-[4.5rem] z-10 bg-[rgba(251,245,224,0.98)] mb-3"
        data-playback-sticky-header
      >
        {/* Episode Header */}
        <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
          <div>
            {/* Mobile layout: Stack everything vertically */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h1 className="retro-headline text-3xl sm:text-6xl mb-2">{episode.title}</h1>

                {/* Segmented tags */}
                <div className="inline-flex items-center gap-3 retro-caps text-[rgba(20,50,86,0.92)] text-base sm:text-xl">
                  <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold">
                    {speakers[0]?.proficiency}
                  </div>
                  <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold capitalize">
                    {speakers[0]?.tone}
                  </div>
                </div>
              </div>

              {/* Controls: Toggles, Speed, and Conversion CTA */}
              <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-6">
                {sentences.length > 0 && (
                  <Link to={`/app/practice/${episode.id}`} className="btn-primary">
                    Practice speaking
                  </Link>
                )}
                {!isGeneratingAudio && currentAudioUrl && (
                  <>
                    {/* Row 1: Furigana & English Toggles - Only show for Japanese */}
                    {episode?.targetLanguage === 'ja' && (
                      <ViewToggleButtons
                        showReadings={showReadings}
                        showTranslations={showTranslations}
                        onToggleReadings={() => setShowReadings(!showReadings)}
                        onToggleTranslations={() => setShowTranslations(!showTranslations)}
                        readingsLabel="Furigana"
                      />
                    )}

                    {/* Row 2: Speed Selector */}
                    <SpeedSelector
                      selectedSpeed={selectedSpeed}
                      onSpeedChange={(speed) => setSelectedSpeed(speed as AudioSpeed)}
                      showLabels
                    />
                  </>
                )}

                {audioCourseEnabled && !hasAudioCourse && (
                  <Link
                    to={
                      viewAsUserId
                        ? `/app/create/audio-course/${episode.id}?viewAs=${viewAsUserId}`
                        : `/app/create/audio-course/${episode.id}`
                    }
                    className="btn-outline text-sm px-3 py-2"
                  >
                    Convert to Audio Course
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Banner (shown during generation) */}
        {isGeneratingAudio && (
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
        )}

        {!isGeneratingAudio && needsAudioGeneration && (
          <div className="retro-paper-panel bg-yellow border-x-2 border-b-2 border-[rgba(20,50,86,0.12)]">
            <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-dark-brown">{audioGenerationTitle}</p>
                <p className="text-xs text-gray-600">{audioGenerationDescription}</p>
              </div>
              <button
                type="button"
                onClick={needsEpisodeRefresh ? retryEpisodeRefresh : generateAllSpeeds}
                disabled={isRefreshingEpisode}
                className="btn-secondary text-sm px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {audioGenerationButtonLabel}
              </button>
            </div>
          </div>
        )}

        {/* Audio Player (shown when not generating) */}
        {!isGeneratingAudio && currentAudioUrl && (
          <div className="retro-paper-panel border-x-2 border-b-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 sm:px-5 py-3">
            <AudioPlayer src={currentAudioUrl} audioRef={audioRef} key={currentAudioUrl} />
          </div>
        )}
      </div>

      {/* Dialogue */}
      <div className="space-y-4 pb-4">
        {sentences.map((sentence) => {
          const speaker = speakerMap.get(sentence.speakerId);
          if (!speaker) return null;

          // Alternate speaker lane tone by index for poster-like contrast
          const speakerIndex = speakerIndexMap.get(sentence.speakerId) ?? 0;
          const isAltSpeaker = speakerIndex % 2 !== 0;

          // Check if this sentence is currently being spoken
          const isCurrentlySpeaking = isSentenceActive(sentence, selectedSpeed, currentTime * 1000);
          const borderTone = isAltSpeaker ? 'rgba(20, 141, 189, 0.72)' : 'rgba(17, 51, 92, 0.58)';

          return (
            <div
              key={sentence.id}
              ref={(el) => {
                if (el) sentenceRefs.current.set(sentence.id, el);
                else sentenceRefs.current.delete(sentence.id);
              }}
              className={`retro-dialog-row retro-playback-v3-row cursor-pointer ${isCurrentlySpeaking ? 'is-active' : ''}`}
              style={{
                // Keep indicator width constant to avoid content reflow while the active sentence changes
                borderLeft: `4px solid ${borderTone}`,
              }}
              onClick={() => seekToSentence(sentence)}
              onKeyDown={(e) => e.key === 'Enter' && seekToSentence(sentence)}
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
                      getSpeakerAvatarUrl(speaker, episode.targetLanguage, speakerIndex)
                    }
                    alt={speaker.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder on error
                      (e.target as HTMLImageElement).src = '/placeholder-avatar.jpg';
                    }}
                  />
                </div>
              </div>

              {/* Target text and translation */}
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
        })}
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage || ''}
        type={toastType}
        isVisible={!!toastMessage}
        onClose={clearToast}
      />
    </div>
  );
};

export default PlaybackPage;
