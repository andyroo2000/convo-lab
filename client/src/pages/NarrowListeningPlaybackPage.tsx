import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Zap } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import AudioPlayer, { RepeatMode } from '../components/AudioPlayer';
import JapaneseText from '../components/JapaneseText';
import ChineseText from '../components/ChineseText';
import SpeedSelector from '../components/common/SpeedSelector';
import ViewToggleButtons from '../components/common/ViewToggleButtons';

import { API_URL } from '../config';

interface StorySegment {
  id: string;
  order: number;
  targetText: string;
  englishTranslation: string;
  reading: string | null;
  startTime_0_7: number | null;
  endTime_0_7: number | null;
  startTime_0_85: number | null;
  endTime_0_85: number | null;
  startTime_1_0: number | null;
  endTime_1_0: number | null;
}

interface StoryVersion {
  id: string;
  variationType: string;
  title: string;
  voiceId: string;
  order: number;
  audioUrl_0_7: string | null;
  audioUrl_0_85: string | null;
  audioUrl_1_0: string | null;
  segments: StorySegment[];
}

interface NarrowListeningPack {
  id: string;
  title: string;
  topic: string;
  targetLanguage: string;
  jlptLevel: string | null;
  hskLevel: string | null;
  cefrLevel: string | null;
  grammarFocus: string | null;
  status: string;
  versions: StoryVersion[];
}

type Speed = '0.7x' | '0.85x' | '1.0x';

export default function NarrowListeningPlaybackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTime, isPlaying, audioRef } = useAudioPlayer();
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const shouldAutoPlay = useRef(false);

  const [pack, setPack] = useState<NarrowListeningPack | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedSpeed, setSelectedSpeed] = useState<Speed>('0.85x');
  const [showReadings, setShowReadings] = useState(false); // Hide furigana by default
  const [showTranslations, setShowTranslations] = useState(true); // Show English translations by default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingSpeed, setGeneratingSpeed] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate selected version and audio URL
  const selectedVersion = pack?.versions.find((v) => v.id === selectedVersionId);
  const currentAudioUrl = selectedVersion
    ? selectedSpeed === '0.7x'
      ? selectedVersion.audioUrl_0_7
      : selectedSpeed === '0.85x'
        ? selectedVersion.audioUrl_0_85
        : selectedVersion.audioUrl_1_0
    : null;

  useEffect(() => {
    loadPack();
  }, [id]);

  // Auto-select first version when pack loads
  useEffect(() => {
    if (pack && !selectedVersionId && pack.versions.length > 0) {
      setSelectedVersionId(pack.versions[0].id);
    }
  }, [pack, selectedVersionId]);

  // Auto-play when version changes (for sequential playback)
  useEffect(() => {
    if (!currentAudioUrl || !shouldAutoPlay.current) {
      shouldAutoPlay.current = false;
      return;
    }

    // Get the audio element from the ref
    const getAudioElement = () => {
      // The audioRef callback stores the element, we need to access it
      // We'll use a small delay to ensure the audio element is ready
      setTimeout(() => {
        const audioElements = document.querySelectorAll('audio');
        const audio = Array.from(audioElements).find((el) => el.src === currentAudioUrl);
        if (audio) {
          audio.play().catch((err) => {
            // Ignore auto-play errors (browser restrictions)
            console.log('Auto-play prevented:', err);
          });
        }
        shouldAutoPlay.current = false;
      }, 100);
    };

    getAudioElement();
  }, [selectedVersionId, currentAudioUrl]);

  // Keyboard controls: Space bar to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle space bar
      if (e.code !== 'Space') return;

      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Prevent default scroll behavior
      e.preventDefault();

      // Toggle play/pause on the audio element
      const audioElements = document.querySelectorAll('audio');
      const audio = audioElements[0] as HTMLAudioElement;
      if (audio) {
        if (audio.paused) {
          audio.play();
        } else {
          audio.pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to current segment
  useEffect(() => {
    if (!selectedVersion || !isPlaying) return;

    const currentSegment = selectedVersion.segments.find((segment) => {
      const startTime =
        selectedSpeed === '0.7x'
          ? segment.startTime_0_7
          : selectedSpeed === '0.85x'
            ? segment.startTime_0_85
            : segment.startTime_1_0;
      const endTime =
        selectedSpeed === '0.7x'
          ? segment.endTime_0_7
          : selectedSpeed === '0.85x'
            ? segment.endTime_0_85
            : segment.endTime_1_0;

      return (
        startTime !== null &&
        endTime !== null &&
        currentTime * 1000 >= startTime &&
        currentTime * 1000 < endTime
      );
    });

    if (currentSegment) {
      const element = segmentRefs.current.get(currentSegment.id);
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
  }, [currentTime, selectedVersion, isPlaying, selectedSpeed]);

  const loadPack = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/narrow-listening/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pack');
      }

      const data = await response.json();
      setPack(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSpeedChange = async (newSpeed: Speed) => {
    setSelectedSpeed(newSpeed);

    // Check if we need to generate audio for any speed that's missing
    if (pack) {
      const audioUrlField =
        newSpeed === '0.7x'
          ? 'audioUrl_0_7'
          : newSpeed === '0.85x'
            ? 'audioUrl_0_85'
            : 'audioUrl_1_0';
      const speedValue = newSpeed === '0.7x' ? 0.7 : newSpeed === '0.85x' ? 0.85 : 1.0;
      const allVersionsHaveSpeed = pack.versions.every((v) => v[audioUrlField]);

      if (!allVersionsHaveSpeed) {
        setGeneratingSpeed(true);
        setGenerationProgress(0);
        try {
          const response = await fetch(
            `${API_URL}/api/narrow-listening/${pack.id}/generate-speed`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ speed: speedValue }),
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to start ${newSpeed} speed generation`);
          }

          const data = await response.json();
          const { jobId } = data;
          setGenerationJobId(jobId);

          // Clear any existing interval
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }

          // Poll job status instead of reloading pack
          pollIntervalRef.current = setInterval(async () => {
            try {
              const jobResponse = await fetch(`${API_URL}/api/narrow-listening/job/${jobId}`, {
                credentials: 'include',
              });

              if (!jobResponse.ok) {
                throw new Error('Failed to fetch job status');
              }

              const jobData = await jobResponse.json();

              // Update progress
              if (typeof jobData.progress === 'number') {
                setGenerationProgress(jobData.progress);
              }

              // Check if job is complete
              if (jobData.state === 'completed') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setGeneratingSpeed(false);
                setGenerationJobId(null);
                setGenerationProgress(100);
                // Reload pack once at the end
                await loadPack();
              } else if (jobData.state === 'failed') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setGeneratingSpeed(false);
                setGenerationJobId(null);
                setGenerationProgress(0);
                console.error('Job failed:', jobData.result);
              }
            } catch (err) {
              console.error('Failed to check job status:', err);
            }
          }, 5000); // Poll every 5 seconds (reduced from 1s to minimize Redis usage)
        } catch (err) {
          console.error(`Failed to generate ${newSpeed} speed audio:`, err);
          setGeneratingSpeed(false);
          setGenerationJobId(null);
          setGenerationProgress(0);
        }
      }
    }
  };

  // Cleanup interval on unmount
  useEffect(
    () => () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    },
    []
  );

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersionId(versionId);
  };

  const handleAudioEnded = () => {
    if (!pack) return;

    // If repeat mode is 'one', replay the current variation
    if (repeatMode === 'one') {
      const audio = audioRef as any;
      if (audio && audio.current) {
        audio.current.currentTime = 0;
        audio.current.play();
      }
      return;
    }

    // Otherwise, move to next variation (for both 'all' and 'off' modes)
    const currentIndex = pack.versions.findIndex((v) => v.id === selectedVersionId);
    const nextIndex = currentIndex + 1;

    if (nextIndex < pack.versions.length) {
      // Play next variation
      shouldAutoPlay.current = true;
      setSelectedVersionId(pack.versions[nextIndex].id);
    } else if (repeatMode === 'all') {
      // Loop back to first variation
      shouldAutoPlay.current = true;
      setSelectedVersionId(pack.versions[0].id);
    }
    // If repeatMode is 'off', do nothing (stop at end)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-700">{error || 'Pack not found'}</p>
          <button onClick={() => navigate('/app/narrow-listening')} className="btn-outline mt-4">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header Container (Header + Audio Player/Progress) */}
      <div className="sticky top-16 z-10 bg-white shadow-lg">
        {/* Episode Header */}
        <div className="border-b border-gray-200 bg-coral">
          <div className="max-w-5xl mx-auto px-4 py-3 lg:px-6 lg:py-4">
            {/* Mobile Layout: Stack vertically */}
            <div className="lg:hidden">
              {/* Title and Pills */}
              <div className="mb-3">
                <h1 className="text-xl font-bold text-dark-brown mb-2">{pack.title}</h1>

                {/* Segmented Pill: Level + Variations */}
                <div className="inline-flex items-center text-xs font-medium overflow-hidden rounded-md shadow-sm">
                  {/* Left segment - Proficiency Level */}
                  <div className="pl-3 pr-4 py-1 bg-periwinkle text-white uppercase tracking-wide">
                    {pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                  </div>

                  {/* Right segment - Variations (with chevron left edge) */}
                  <div
                    className="pl-2 pr-3 py-1 bg-strawberry text-white capitalize relative"
                    style={{
                      clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 6px 100%, 0% 50%)',
                      marginLeft: '-6px',
                    }}
                  >
                    <span className="ml-1.5">{pack.versions.length} variations</span>
                  </div>
                </div>

                {pack.grammarFocus && (
                  <p className="text-xs text-gray-600 mt-1.5">
                    <strong>Focus:</strong> {pack.grammarFocus}
                  </p>
                )}
              </div>

              {/* Controls: Toggles and Speed Selector - Below on mobile */}
              {!generatingSpeed && currentAudioUrl && (
                <div className="flex flex-col gap-2">
                  {/* Row 1: Furigana & English Toggles - Only show for languages with readings (ja, zh) */}
                  {(pack.targetLanguage === 'ja' || pack.targetLanguage === 'zh') && (
                    <ViewToggleButtons
                      showReadings={showReadings}
                      showTranslations={showTranslations}
                      onToggleReadings={() => setShowReadings(!showReadings)}
                      onToggleTranslations={() => setShowTranslations(!showTranslations)}
                      readingsLabel={pack.targetLanguage === 'zh' ? 'Pinyin' : 'Furigana'}
                    />
                  )}

                  {/* Row 2: Speed Selector */}
                  <SpeedSelector
                    selectedSpeed={selectedSpeed}
                    onSpeedChange={(speed) => handleSpeedChange(speed as Speed)}
                    disabled={generatingSpeed}
                    loading={generatingSpeed}
                    loadingSpeed={selectedSpeed}
                    showLabels
                  />
                </div>
              )}
            </div>

            {/* Desktop Layout: Side by side */}
            <div className="hidden lg:flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-dark-brown mb-2">{pack.title}</h1>

                {/* Segmented Pill: Level + Variations */}
                <div className="inline-flex items-center text-sm font-medium overflow-hidden rounded-md shadow-sm">
                  {/* Left segment - Proficiency Level */}
                  <div className="pl-4 pr-5 py-1.5 bg-periwinkle text-white uppercase tracking-wide">
                    {pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                  </div>

                  {/* Right segment - Variations (with chevron left edge) */}
                  <div
                    className="pl-3 pr-4 py-1.5 bg-strawberry text-white capitalize relative"
                    style={{
                      clipPath: 'polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%)',
                      marginLeft: '-8px',
                    }}
                  >
                    <span className="ml-2">{pack.versions.length} variations</span>
                  </div>
                </div>

                {pack.grammarFocus && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Focus:</strong> {pack.grammarFocus}
                  </p>
                )}
              </div>

              {/* Controls: Toggles and Speed Selector */}
              {!generatingSpeed && currentAudioUrl && (
                <div className="flex flex-col items-end gap-2 ml-6">
                  {/* Row 1: Furigana & English Toggles - Only show for languages with readings (ja, zh) */}
                  {(pack.targetLanguage === 'ja' || pack.targetLanguage === 'zh') && (
                    <ViewToggleButtons
                      showReadings={showReadings}
                      showTranslations={showTranslations}
                      onToggleReadings={() => setShowReadings(!showReadings)}
                      onToggleTranslations={() => setShowTranslations(!showTranslations)}
                      readingsLabel={pack.targetLanguage === 'zh' ? 'Pinyin' : 'Furigana'}
                    />
                  )}

                  {/* Row 2: Speed Selector */}
                  <SpeedSelector
                    selectedSpeed={selectedSpeed}
                    onSpeedChange={(speed) => handleSpeedChange(speed as Speed)}
                    disabled={generatingSpeed}
                    loading={generatingSpeed}
                    loadingSpeed={selectedSpeed}
                    showLabels
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Banner (shown during generation) */}
        {generatingSpeed && (
          <div className="bg-yellow border-b border-periwinkle">
            <div className="max-w-5xl mx-auto px-4 py-3 lg:px-6 lg:py-4">
              <div className="flex items-center gap-3 lg:gap-4">
                <Loader className="w-5 h-5 text-dark-brown animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs lg:text-sm font-medium text-dark-brown">
                      Generating {selectedSpeed} speed audio...
                    </p>
                    <span className="text-xs lg:text-sm font-semibold text-dark-brown">
                      {generationProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-strawberry h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-periwinkle-dark mt-1 hidden lg:block">
                    Please wait while we generate audio for all variations. This may take a minute
                    or two.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player (shown when not generating) */}
        {currentAudioUrl && !generatingSpeed && (
          <div className="bg-yellow border-b border-gray-200">
            <div className="max-w-5xl mx-auto px-4 py-2 lg:px-6 lg:py-3">
              <AudioPlayer
                src={currentAudioUrl}
                audioRef={audioRef}
                key={`${selectedVersionId}-${selectedSpeed}`}
                repeatMode={repeatMode}
                onRepeatModeChange={setRepeatMode}
                onEnded={handleAudioEnded}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Version List - Sticky on desktop only */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[280px]">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Story Variations</h3>
              <div className="space-y-2">
                {pack.versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => handleVersionSelect(version.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedVersionId === version.id
                        ? 'border-strawberry bg-strawberry text-white font-bold shadow-md'
                        : 'border-gray-200 bg-white hover:border-strawberry hover:bg-strawberry-light'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{version.title}</p>
                      </div>
                      {selectedVersionId === version.id && isPlaying && (
                        <Zap className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className="lg:col-span-2">
            {selectedVersion ? (
              <div className="bg-white rounded-lg border p-6">
                {/* Story Text */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-gray-900">Story Text</h4>
                  {selectedVersion.segments.map((segment, idx) => {
                    // Calculate if this segment is currently speaking
                    const startTime =
                      selectedSpeed === '0.7x'
                        ? segment.startTime_0_7
                        : selectedSpeed === '0.85x'
                          ? segment.startTime_0_85
                          : segment.startTime_1_0;
                    const endTime =
                      selectedSpeed === '0.7x'
                        ? segment.endTime_0_7
                        : selectedSpeed === '0.85x'
                          ? segment.endTime_0_85
                          : segment.endTime_1_0;

                    const isCurrentlySpeaking =
                      startTime !== null &&
                      endTime !== null &&
                      currentTime * 1000 >= startTime &&
                      currentTime * 1000 < endTime;

                    return (
                      <div
                        key={segment.id}
                        ref={(el) => {
                          if (el) segmentRefs.current.set(segment.id, el);
                          else segmentRefs.current.delete(segment.id);
                        }}
                        className="pl-4 py-3 rounded-lg transition-all duration-200"
                        style={{
                          backgroundColor: isCurrentlySpeaking
                            ? 'rgba(252, 102, 167, 0.35)'
                            : 'rgba(252, 102, 167, 0.15)',
                          borderLeft: `${isCurrentlySpeaking ? '6px' : '4px'} solid #FC66A7`,
                          borderRight: isCurrentlySpeaking ? '3px solid #FC66A7' : undefined,
                          borderTop: isCurrentlySpeaking ? '3px solid #FC66A7' : undefined,
                          borderBottom: isCurrentlySpeaking ? '3px solid #FC66A7' : undefined,
                          boxShadow: isCurrentlySpeaking
                            ? '0 4px 12px rgba(252, 102, 167, 0.25)'
                            : 'none',
                        }}
                      >
                        <p
                          className={`text-lg text-dark-brown leading-relaxed ${showTranslations ? 'mb-2' : ''}`}
                        >
                          {pack.targetLanguage === 'zh' ? (
                            <ChineseText
                              text={segment.targetText}
                              pinyin={segment.reading || undefined}
                              showPinyin={showReadings}
                            />
                          ) : (
                            <JapaneseText
                              text={segment.targetText}
                              metadata={
                                segment.reading
                                  ? {
                                      japanese: {
                                        kanji: segment.targetText,
                                        kana: '',
                                        furigana: segment.reading,
                                      },
                                    }
                                  : undefined
                              }
                              showFurigana={showReadings}
                            />
                          )}
                        </p>
                        {showTranslations && (
                          <p className="text-sm text-gray-600 italic">
                            {segment.englishTranslation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center">
                <p className="text-gray-600">Select a variation to start listening</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
