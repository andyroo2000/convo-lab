import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { TTS_VOICES, getSpeakerColor } from '@languageflow/shared/src/constants-new';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSpeakerAvatars } from '../hooks/useSpeakerAvatars';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { Episode, Sentence, AudioSpeed, Speaker } from '../types';
import JapaneseText from '../components/JapaneseText';
import AudioPlayer from '../components/AudioPlayer';
import Toast from '../components/common/Toast';
import SpeedSelector from '../components/common/SpeedSelector';
import ViewToggleButtons from '../components/common/ViewToggleButtons';
import { API_URL } from '../config';

// Helper function to get avatar URL based on speaker voice and gender
function getSpeakerAvatarFilename(
  speaker: Speaker,
  targetLanguage: string,
  speakerIndex: number
): string {
  // Determine gender from voiceId by looking it up in TTS_VOICES
  const languageVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const voiceInfo = languageVoices.find((v) => v.id === speaker.voiceId);
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
    loading,
  } = useEpisodes();
  const { isFeatureEnabled } = useFeatureFlags();
  const { audioRef, currentTime, isPlaying, seek, play, pause } = useAudioPlayer();
  const { avatarUrlMap } = useSpeakerAvatars();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedSpeed, setSelectedSpeed] = useState<AudioSpeed>('medium');
  const [showReadings, setShowReadings] = useState(false); // Hide furigana by default
  const [showTranslations, setShowTranslations] = useState(true); // Show English translations by default
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCourseEnabled = isFeatureEnabled('audioCourseEnabled');

  // Normalize speed values: '0.7x', 'slow', 0.7 all map to slow
  // Must be defined before useEffect hooks that reference speedKey
  const normalizeSpeedKey = (speed: AudioSpeed): 'slow' | 'medium' | 'normal' => {
    if (speed === '0.7x' || speed === 'slow' || speed === 0.7) return 'slow';
    if (speed === '0.85x' || speed === 'medium' || speed === 0.85) return 'medium';
    return 'normal'; // '1.0x', 'normal', 1.0
  };
  const speedKey = normalizeSpeedKey(selectedSpeed);

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

  const loadEpisode = async (bustCache = false) => {
    if (!episodeId) return;
    try {
      const data = await getEpisode(episodeId, bustCache, viewAsUserId);
      setEpisode(data);
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  };

  const handleGenerateAllSpeeds = async () => {
    if (!episode || !episode.dialogue) return;

    setIsGeneratingAudio(true);
    setGenerationProgress(0);

    try {
      const jobId = await generateAllSpeedsAudio(episode.id, episode.dialogue.id);

      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      const startTime = Date.now();
      const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes timeout

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          // Check for timeout
          if (Date.now() - startTime > MAX_POLL_DURATION) {
            clearInterval(pollInterval);
            pollingIntervalRef.current = null;
            setIsGeneratingAudio(false);
            setGenerationProgress(0);
            setToastMessage('Audio generation timed out. Please try again.');
            setToastType('error');
            return;
          }

          const response = await fetch(`${API_URL}/api/audio/job/${jobId}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();

            // Update progress
            if (data.progress !== undefined) {
              setGenerationProgress(data.progress);
            }

            // Check if completed
            if (data.state === 'completed') {
              clearInterval(pollInterval);
              pollingIntervalRef.current = null;
              await loadEpisode(true); // Bust cache to get fresh data with audio URLs
              setIsGeneratingAudio(false);
              setGenerationProgress(0);
              setToastMessage('Audio generated successfully!');
              setToastType('success');
            } else if (data.state === 'failed') {
              clearInterval(pollInterval);
              pollingIntervalRef.current = null;
              setIsGeneratingAudio(false);
              setGenerationProgress(0);
              setToastMessage('Failed to generate audio. Please try again.');
              setToastType('error');
            }
          }
        } catch (err) {
          console.error('Error polling job:', err);
          clearInterval(pollInterval);
          pollingIntervalRef.current = null;
          setIsGeneratingAudio(false);
          setGenerationProgress(0);
          setToastMessage('Failed to check generation status. Please refresh the page.');
          setToastType('error');
        }
      }, 1000);

      pollingIntervalRef.current = pollInterval;
    } catch (err) {
      console.error('Failed to start audio generation:', err);
      setIsGeneratingAudio(false);
      setGenerationProgress(0);
      setToastMessage('Failed to start audio generation. Please try again.');
      setToastType('error');
    }
  };

  useEffect(() => {
    if (episodeId) {
      loadEpisode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  // Track which episode we've already triggered generation for to prevent duplicates
  const lastProcessedEpisodeRef = useRef<string | null>(null);

  // Auto-generate missing audio speeds
  useEffect(() => {
    if (!episode || !episode.dialogue) return;
    if (episode.autoGenerateAudio === false) return;

    // Already processed this episode in this session
    if (lastProcessedEpisodeRef.current === episode.id) return;

    // Check sessionStorage to see if we've already queued generation for this episode
    const processedEpisodes = sessionStorage.getItem('audio-generation-queued');
    const processedList = processedEpisodes ? JSON.parse(processedEpisodes) : [];
    if (processedList.includes(episode.id)) {
      lastProcessedEpisodeRef.current = episode.id;
      return;
    }

    // Check if all three speeds are available
    const hasAllSpeeds = episode.audioUrl_0_7 && episode.audioUrl_0_85 && episode.audioUrl_1_0;

    if (!hasAllSpeeds && !isGeneratingAudio) {
      lastProcessedEpisodeRef.current = episode.id;

      // Mark this episode as processed in sessionStorage
      const updated = [...processedList, episode.id];
      sessionStorage.setItem('audio-generation-queued', JSON.stringify(updated));

      handleGenerateAllSpeeds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, isGeneratingAudio]);

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

        // Helper function to get effective start time for current speed
        const getEffectiveStartTime = (sentence: Sentence) => {
          /* eslint-disable no-nested-ternary */
          const startTime =
            speedKey === 'slow'
              ? sentence.startTime_0_7
              : speedKey === 'medium'
                ? sentence.startTime_0_85
                : sentence.startTime_1_0;
          /* eslint-enable no-nested-ternary */
          return startTime !== undefined ? startTime : sentence.startTime;
        };

        // Helper function to get effective end time for current speed
        const getEffectiveEndTime = (sentence: Sentence) => {
          /* eslint-disable no-nested-ternary */
          const endTime =
            speedKey === 'slow'
              ? sentence.endTime_0_7
              : speedKey === 'medium'
                ? sentence.endTime_0_85
                : sentence.endTime_1_0;
          /* eslint-enable no-nested-ternary */
          return endTime !== undefined ? endTime : sentence.endTime;
        };

        // Find current sentence index
        let currentIndex = sentences.findIndex((sentence) => {
          const start = getEffectiveStartTime(sentence);
          const end = getEffectiveEndTime(sentence);
          return (
            start !== undefined &&
            end !== undefined &&
            currentTimeMs >= start &&
            currentTimeMs < end
          );
        });

        // If not in a sentence, find the closest one before current time
        if (currentIndex === -1) {
          currentIndex = sentences.findIndex((sentence) => {
            const start = getEffectiveStartTime(sentence);
            return start !== undefined && currentTimeMs < start;
          });
          // If we're before all sentences, start at 0, else use previous sentence
          currentIndex = currentIndex === -1 ? sentences.length - 1 : Math.max(0, currentIndex - 1);
        }

        if (e.code === 'ArrowLeft') {
          // Left arrow: go to beginning of current turn, or previous turn if at the start
          const currentSentence = sentences[currentIndex];
          const currentStart = getEffectiveStartTime(currentSentence);

          if (currentStart !== undefined) {
            // If we're more than 1 second into the current turn, go to its beginning
            if (currentTimeMs - currentStart > 1000) {
              seek(currentStart / 1000);
            } else {
              // Otherwise go to previous turn
              const prevIndex = Math.max(0, currentIndex - 1);
              const prevSentence = sentences[prevIndex];
              const prevStart = getEffectiveStartTime(prevSentence);

              if (prevStart !== undefined) {
                seek(prevStart / 1000);
              }
            }
          }
        } else if (e.code === 'ArrowRight') {
          // Right arrow: go to beginning of next turn
          const nextIndex = Math.min(sentences.length - 1, currentIndex + 1);
          const nextSentence = sentences[nextIndex];
          const nextStart = getEffectiveStartTime(nextSentence);

          if (nextStart !== undefined) {
            seek(nextStart / 1000);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, episode, currentTime, seek, speedKey]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!episode?.dialogue?.sentences) return;

    const currentSentence = episode.dialogue.sentences.find((sentence) => {
      // Get timing for current speed
      /* eslint-disable no-nested-ternary */
      const startTime =
        speedKey === 'slow'
          ? sentence.startTime_0_7
          : speedKey === 'medium'
            ? sentence.startTime_0_85
            : sentence.startTime_1_0;
      const endTime =
        speedKey === 'slow'
          ? sentence.endTime_0_7
          : speedKey === 'medium'
            ? sentence.endTime_0_85
            : sentence.endTime_1_0;
      /* eslint-enable no-nested-ternary */

      // Fallback to legacy timing
      const effectiveStartTime = startTime !== undefined ? startTime : sentence.startTime;
      const effectiveEndTime = endTime !== undefined ? endTime : sentence.endTime;

      return (
        effectiveStartTime !== undefined &&
        effectiveEndTime !== undefined &&
        currentTime * 1000 >= effectiveStartTime &&
        currentTime * 1000 < effectiveEndTime
      );
    });

    if (currentSentence) {
      const element = sentenceRefs.current.get(currentSentence.id);
      if (element) {
        // Calculate the actual height of the sticky header dynamically
        const stickyHeader = document.querySelector('.sticky.top-16');
        const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
        const navHeight = 64; // nav bar height
        const yOffset = -(navHeight + headerHeight + 20); // Add 20px padding
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, episode, selectedSpeed]);

  // Cleanup polling interval on unmount
  useEffect(
    () => () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    },
    []
  );

  const seekToSentence = (sentence: Sentence) => {
    // Get timing for current speed
    /* eslint-disable no-nested-ternary */
    const startTime =
      speedKey === 'slow'
        ? sentence.startTime_0_7
        : speedKey === 'medium'
          ? sentence.startTime_0_85
          : sentence.startTime_1_0;
    /* eslint-enable no-nested-ternary */

    // Fallback to legacy timing if multi-speed timing not available
    const effectiveStartTime = startTime !== undefined ? startTime : sentence.startTime;

    if (effectiveStartTime !== undefined) {
      // Convert milliseconds to seconds
      seek(effectiveStartTime / 1000);
      // Play if not already playing
      if (!isPlaying) {
        play();
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center py-12">
          <p className="text-gray-600">Episode not found</p>
        </div>
      </div>
    );
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

  // Get current audio URL based on selected speed
  /* eslint-disable no-nested-ternary */
  const currentAudioUrl = hasAllSpeeds
    ? speedKey === 'slow'
      ? episode.audioUrl_0_7
      : speedKey === 'medium'
        ? episode.audioUrl_0_85
        : episode.audioUrl_1_0
    : episode.audioUrl; // Fallback to legacy for old episodes
  /* eslint-enable no-nested-ternary */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header Container (Header + Audio Player/Progress) */}
      <div className="sticky top-16 z-10 bg-white shadow-lg">
        {/* Episode Header */}
        <div className="border-b border-gray-200 bg-coral">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            {/* Mobile layout: Stack everything vertically */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <h1 className="text-xl sm:text-3xl font-bold text-dark-brown mb-2">
                  {episode.title}
                </h1>

                {/* Segmented Pill: Proficiency Level + Tone */}
                <div className="inline-flex items-center text-xs sm:text-sm font-medium overflow-hidden rounded-md shadow-sm">
                  {/* Left segment - Proficiency Level */}
                  <div className="pl-3 sm:pl-4 pr-4 sm:pr-5 py-1 sm:py-1.5 bg-periwinkle text-white uppercase tracking-wide">
                    {speakers[0]?.proficiency}
                  </div>

                  {/* Right segment - Tone (with chevron left edge) */}
                  <div
                    className="pl-2 sm:pl-3 pr-3 sm:pr-4 py-1 sm:py-1.5 bg-strawberry text-white capitalize relative"
                    style={{
                      clipPath: 'polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%)',
                      marginLeft: '-8px',
                    }}
                  >
                    <span className="ml-2">{speakers[0]?.tone}</span>
                  </div>
                </div>
              </div>

              {/* Controls: Toggles, Speed, and Conversion CTA */}
              <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-6">
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
          <div className="bg-yellow border-b border-periwinkle">
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
          <div className="bg-yellow border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-dark-brown">
                  {hasAnyAudio ? 'More audio speeds are available.' : 'Audio isn’t generated yet.'}
                </p>
                <p className="text-xs text-gray-600">
                  {autoGenerationEnabled
                    ? 'Generate audio to enable slow, medium, and normal playback.'
                    : 'Auto-generation is off for this dialogue. Generate audio to enable playback.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAllSpeeds}
                className="btn-secondary text-sm px-3 py-2"
              >
                Generate Audio
              </button>
            </div>
          </div>
        )}

        {/* Audio Player (shown when not generating) */}
        {!isGeneratingAudio && currentAudioUrl && (
          <div className="bg-yellow border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
              <AudioPlayer src={currentAudioUrl} audioRef={audioRef} key={currentAudioUrl} />
            </div>
          </div>
        )}
      </div>

      {/* Dialogue */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-3">
          {sentences.map((sentence, _index) => {
            const speaker = speakerMap.get(sentence.speakerId);
            if (!speaker) return null;

            // Get speaker color based on index (runtime assignment)
            const speakerIndex = speakerIndexMap.get(sentence.speakerId) ?? 0;
            const speakerColor = getSpeakerColor(speakerIndex);

            // Get timing for current speed
            /* eslint-disable no-nested-ternary */
            const startTime =
              speedKey === 'slow'
                ? sentence.startTime_0_7
                : speedKey === 'medium'
                  ? sentence.startTime_0_85
                  : sentence.startTime_1_0;
            const endTime =
              speedKey === 'slow'
                ? sentence.endTime_0_7
                : speedKey === 'medium'
                  ? sentence.endTime_0_85
                  : sentence.endTime_1_0;
            /* eslint-enable no-nested-ternary */

            // Fallback to legacy timing if multi-speed timing not available
            const effectiveStartTime = startTime !== undefined ? startTime : sentence.startTime;
            const effectiveEndTime = endTime !== undefined ? endTime : sentence.endTime;

            // Check if this sentence is currently being spoken
            const isCurrentlySpeaking =
              effectiveStartTime !== undefined &&
              effectiveEndTime !== undefined &&
              currentTime * 1000 >= effectiveStartTime &&
              currentTime * 1000 < effectiveEndTime;

            // Convert hex color to rgba with opacity
            const hexToRgba = (hex: string, alpha: number) => {
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            return (
              <div
                key={sentence.id}
                ref={(el) => {
                  if (el) sentenceRefs.current.set(sentence.id, el);
                  else sentenceRefs.current.delete(sentence.id);
                }}
                className={`card hover:shadow-md transition-all duration-300 cursor-pointer ${
                  isCurrentlySpeaking ? 'shadow-lg' : ''
                }`}
                style={{
                  backgroundColor: hexToRgba(speakerColor, isCurrentlySpeaking ? 0.25 : 0.15),
                  borderLeft: `${isCurrentlySpeaking ? '6px' : '4px'} solid ${speakerColor}`,
                  borderRight: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                  borderTop: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                  borderBottom: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                }}
                onClick={() => seekToSentence(sentence)}
                onKeyDown={(e) => e.key === 'Enter' && seekToSentence(sentence)}
                role="button"
                tabIndex={0}
                data-testid={`playback-sentence-${sentence.id}`}
              >
                <div className="flex gap-3 sm:gap-8">
                  {/* Speaker Avatar - Smaller on mobile */}
                  <div
                    className="w-20 sm:w-40 flex-shrink-0 flex flex-col items-center justify-center gap-1 sm:gap-2 pl-2 sm:pl-4 pr-3 sm:pr-6 pt-3 sm:pt-6 pb-2 sm:pb-3 -my-6 -ml-6"
                    style={{
                      backgroundColor: speakerColor,
                      opacity: 0.9,
                    }}
                  >
                    <div className="w-12 h-12 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md bg-white">
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
                    <span className="text-xs sm:text-sm font-bold text-white text-center drop-shadow-md">
                      {episode.targetLanguage === 'ja' ? (
                        <JapaneseText text={speaker.name} showFurigana={showReadings} />
                      ) : (
                        <span>{speaker.name}</span>
                      )}
                    </span>
                  </div>

                  {/* Japanese Text and Translation - Stack on mobile, side by side on desktop */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 flex-1">
                    {/* Target Language Text - Flexible Column */}
                    <div className={showTranslations ? 'flex-1 sm:pr-6' : 'w-full'}>
                      <p className="text-base sm:text-lg text-dark-brown leading-relaxed">
                        {episode.targetLanguage === 'ja' ? (
                          <JapaneseText
                            text={sentence.text}
                            metadata={sentence.metadata}
                            showFurigana={showReadings}
                          />
                        ) : (
                          <span className="text-xl sm:text-2xl">{sentence.text}</span>
                        )}
                      </p>
                    </div>

                    {/* Translation - Right Column on desktop, below on mobile (conditionally rendered) */}
                    {showTranslations && (
                      <div
                        className="flex-1 pt-3 sm:pt-0 sm:pl-6 sm:border-l"
                        style={{
                          borderColor: `${hexToRgba(speakerColor, 0.3)}`,
                        }}
                      >
                        <p className="text-sm sm:text-base text-gray-600 italic">
                          {sentence.translation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage || ''}
        type={toastType}
        isVisible={!!toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};

export default PlaybackPage;
