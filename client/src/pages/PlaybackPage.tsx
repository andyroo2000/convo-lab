import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { Episode, Sentence, AudioSpeed, Speaker } from '../types';
import JapaneseText from '../components/JapaneseText';
import AudioPlayer from '../components/AudioPlayer';
import Toast from '../components/common/Toast';
import { TTS_VOICES } from '../../../shared/src/constants';

// Helper function to get avatar URL based on speaker voice and tone
function getSpeakerAvatarUrl(speaker: Speaker, targetLanguage: string): string {
  // Determine gender from voiceId by looking it up in TTS_VOICES
  const languageVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const voiceInfo = languageVoices.find(v => v.id === speaker.voiceId);
  const gender = voiceInfo?.gender || 'male'; // Fallback to male if not found

  // Map tone to our avatar naming convention
  const tone = speaker.tone.toLowerCase();

  // Construct avatar filename: {language}-{gender}-{tone}.jpg
  return `/avatars/${targetLanguage}-${gender}-${tone}.jpg`;
}

export default function PlaybackPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { getEpisode, generateAudio, generateAllSpeedsAudio, pollJobStatus, loading } = useEpisodes();
  const { audioRef, currentTime, isPlaying, seek, play, pause } = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedSpeed, setSelectedSpeed] = useState<AudioSpeed>('medium');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    if (episodeId) {
      loadEpisode();
    }
  }, [episodeId]);

  // Auto-generate missing audio speeds
  useEffect(() => {
    if (!episode || !episode.dialogue) return;

    // Check if all three speeds are available
    const hasAllSpeeds = episode.audioUrl_0_7 && episode.audioUrl_0_85 && episode.audioUrl_1_0;

    if (!hasAllSpeeds && !isGeneratingAudio) {
      console.log('Missing audio speeds, generating all speeds...');
      handleGenerateAllSpeeds();
    }
  }, [episode]);

  // Keyboard controls: Space bar to play/pause, Arrow keys to navigate turns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
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

        const sentences = episode.dialogue.sentences;
        const currentTimeMs = currentTime * 1000;

        // Helper function to get effective start time for current speed
        const getEffectiveStartTime = (sentence: any) => {
          const startTime = selectedSpeed === 'slow' ? sentence.startTime_0_7
            : selectedSpeed === 'medium' ? sentence.startTime_0_85
            : sentence.startTime_1_0;
          return startTime !== undefined ? startTime : sentence.startTime;
        };

        // Helper function to get effective end time for current speed
        const getEffectiveEndTime = (sentence: any) => {
          const endTime = selectedSpeed === 'slow' ? sentence.endTime_0_7
            : selectedSpeed === 'medium' ? sentence.endTime_0_85
            : sentence.endTime_1_0;
          return endTime !== undefined ? endTime : sentence.endTime;
        };

        // Find current sentence index
        let currentIndex = sentences.findIndex(
          (sentence) => {
            const start = getEffectiveStartTime(sentence);
            const end = getEffectiveEndTime(sentence);
            return start !== undefined &&
              end !== undefined &&
              currentTimeMs >= start &&
              currentTimeMs < end;
          }
        );

        // If not in a sentence, find the closest one before current time
        if (currentIndex === -1) {
          currentIndex = sentences.findIndex(
            (sentence) => {
              const start = getEffectiveStartTime(sentence);
              return start !== undefined && currentTimeMs < start;
            }
          );
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
  }, [isPlaying, play, pause, episode, currentTime, seek]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!episode?.dialogue?.sentences) return;

    const currentSentence = episode.dialogue.sentences.find(
      (sentence) => {
        // Get timing for current speed
        const startTime = selectedSpeed === 'slow' ? sentence.startTime_0_7
          : selectedSpeed === 'medium' ? sentence.startTime_0_85
          : sentence.startTime_1_0;
        const endTime = selectedSpeed === 'slow' ? sentence.endTime_0_7
          : selectedSpeed === 'medium' ? sentence.endTime_0_85
          : sentence.endTime_1_0;

        // Fallback to legacy timing
        const effectiveStartTime = startTime !== undefined ? startTime : sentence.startTime;
        const effectiveEndTime = endTime !== undefined ? endTime : sentence.endTime;

        return effectiveStartTime !== undefined &&
          effectiveEndTime !== undefined &&
          currentTime * 1000 >= effectiveStartTime &&
          currentTime * 1000 < effectiveEndTime;
      }
    );

    if (currentSentence) {
      const element = sentenceRefs.current.get(currentSentence.id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentTime, episode, selectedSpeed]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const loadEpisode = async () => {
    if (!episodeId) return;
    try {
      const data = await getEpisode(episodeId);
      setEpisode(data);
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  };

  const seekToSentence = (sentence: Sentence) => {
    // Get timing for current speed
    const startTime = selectedSpeed === 'slow' ? sentence.startTime_0_7
      : selectedSpeed === 'medium' ? sentence.startTime_0_85
      : sentence.startTime_1_0;

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

  const handleGenerateAllSpeeds = async () => {
    if (!episode || !episode.dialogue) return;

    setIsGeneratingAudio(true);
    setGenerationProgress(0);

    try {
      const jobId = await generateAllSpeedsAudio(episode.id, episode.dialogue.id);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/audio/job/${jobId}`, {
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
              await loadEpisode();
              setIsGeneratingAudio(false);
              setGenerationProgress(0);
            } else if (data.state === 'failed') {
              clearInterval(pollInterval);
              pollingIntervalRef.current = null;
              setIsGeneratingAudio(false);
              setGenerationProgress(0);
              alert('Failed to generate audio. Please try again.');
            }
          }
        } catch (err) {
          console.error('Error polling job:', err);
        }
      }, 1000);

      pollingIntervalRef.current = pollInterval;
    } catch (err) {
      console.error('Failed to start audio generation:', err);
      setIsGeneratingAudio(false);
      setGenerationProgress(0);
      alert('Failed to start audio generation. Please try again.');
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

  const dialogue = episode.dialogue;
  const speakers = dialogue?.speakers || [];
  const sentences = dialogue?.sentences || [];

  // Create speaker map for quick lookup
  const speakerMap = new Map(speakers.map(s => [s.id, s]));

  // Get current audio URL based on selected speed
  const currentAudioUrl = episode.audioUrl_0_7 && episode.audioUrl_0_85 && episode.audioUrl_1_0
    ? (selectedSpeed === 'slow' ? episode.audioUrl_0_7
      : selectedSpeed === 'medium' ? episode.audioUrl_0_85
      : episode.audioUrl_1_0)
    : episode.audioUrl; // Fallback to legacy for old episodes

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Episode Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-navy mb-1">{episode.title}</h1>
              <p className="text-sm text-gray-600 mb-4">
                {speakers[0]?.proficiency}, {speakers[0]?.tone}
              </p>

              {/* Speakers Legend */}
              <div className="flex gap-6 flex-wrap">
                {speakers.map((speaker) => (
                  <div key={speaker.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: speaker.color }}
                    />
                    <span className="text-sm font-medium text-navy">
                      <JapaneseText text={speaker.name} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Speed Selector */}
            {!isGeneratingAudio && currentAudioUrl && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 ml-6">
                <button
                  onClick={() => setSelectedSpeed('slow')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    selectedSpeed === 'slow'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Slow (0.7x)
                </button>
                <button
                  onClick={() => setSelectedSpeed('medium')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    selectedSpeed === 'medium'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Medium (0.85x)
                </button>
                <button
                  onClick={() => setSelectedSpeed('normal')}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    selectedSpeed === 'normal'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Normal (1.0x)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Banner (shown during generation) */}
      {isGeneratingAudio && (
        <div className="sticky top-16 z-10 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 shadow-md">
          <div className="flex items-center gap-4 p-4">
            <div className="flex-shrink-0">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900 mb-1">
                Generating audio at all speeds...
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-purple-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-purple-700 min-w-[3rem] text-right">
                  {generationProgress}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player - Sticky (shown when not generating) */}
      {!isGeneratingAudio && currentAudioUrl && (
        <div className="sticky top-16 z-10 bg-pale-sky border-b border-gray-200 shadow-md">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <AudioPlayer
              src={currentAudioUrl}
              audioRef={audioRef}
              key={currentAudioUrl}
            />
          </div>
        </div>
      )}

      {/* Dialogue */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {sentences.map((sentence, index) => {
          const speaker = speakerMap.get(sentence.speakerId);
          if (!speaker) return null;

          // Get timing for current speed
          const startTime = selectedSpeed === 'slow' ? sentence.startTime_0_7
            : selectedSpeed === 'medium' ? sentence.startTime_0_85
            : sentence.startTime_1_0;
          const endTime = selectedSpeed === 'slow' ? sentence.endTime_0_7
            : selectedSpeed === 'medium' ? sentence.endTime_0_85
            : sentence.endTime_1_0;

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
                backgroundColor: hexToRgba(speaker.color, isCurrentlySpeaking ? 0.18 : 0.08),
                borderLeft: `${isCurrentlySpeaking ? '6px' : '4px'} solid ${speaker.color}`,
                borderRight: isCurrentlySpeaking ? `3px solid ${speaker.color}` : undefined,
                borderTop: isCurrentlySpeaking ? `3px solid ${speaker.color}` : undefined,
                borderBottom: isCurrentlySpeaking ? `3px solid ${speaker.color}` : undefined,
              }}
              onClick={() => seekToSentence(sentence)}
            >
              <div className="flex gap-4">
                {/* Speaker Avatar */}
                <div className="flex-shrink-0">
                  <div
                    className="w-24 h-24 rounded-full overflow-hidden border-solid"
                    style={{ borderColor: speaker.color, borderWidth: '3px' }}
                  >
                    <img
                      src={getSpeakerAvatarUrl(speaker, episode.targetLanguage)}
                      alt={speaker.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Japanese Text and Translation - Side by Side */}
                <div className="flex gap-0 flex-1">
                  {/* Japanese Text - Left Column */}
                  <div className="flex-1 pr-6">
                    <p className="text-lg text-navy leading-relaxed">
                      <JapaneseText
                        text={sentence.text}
                        metadata={sentence.metadata}
                      />
                    </p>
                  </div>

                  {/* Translation - Right Column */}
                  <div
                    className="flex-1 pl-6"
                    style={{
                      borderLeft: `1px solid ${hexToRgba(speaker.color, 0.3)}`
                    }}
                  >
                    <p className="text-gray-600 italic">
                      {sentence.translation}
                    </p>
                  </div>
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
}
