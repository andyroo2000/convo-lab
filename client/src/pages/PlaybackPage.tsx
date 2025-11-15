import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { Episode, Sentence, Speaker } from '../types';
import JapaneseText from '../components/JapaneseText';

export default function PlaybackPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { getEpisode, generateAudio, pollJobStatus, loading } = useEpisodes();
  const { audioRef, currentTime, isPlaying } = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Map<string, number>>(new Map());
  const [openSelector, setOpenSelector] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Debug: Log when currentTime or isPlaying changes
  useEffect(() => {
    console.log('Audio state changed - Time:', currentTime, 'Playing:', isPlaying);
  }, [currentTime, isPlaying]);

  useEffect(() => {
    if (episodeId) {
      loadEpisode();
    }
  }, [episodeId]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!episode?.dialogue?.sentences) return;

    // Debug: Log timing info
    console.log('Current time (seconds):', currentTime);
    console.log('Current time (ms):', currentTime * 1000);

    const currentSentence = episode.dialogue.sentences.find(
      (sentence) => {
        const isMatch = sentence.startTime !== undefined &&
          sentence.endTime !== undefined &&
          currentTime * 1000 >= sentence.startTime &&
          currentTime * 1000 < sentence.endTime;

        if (sentence.startTime !== undefined && sentence.endTime !== undefined) {
          console.log(`Sentence ${sentence.order}: ${sentence.startTime}-${sentence.endTime}ms, Match: ${isMatch}`);
        }

        return isMatch;
      }
    );

    if (currentSentence) {
      console.log('Currently playing sentence:', currentSentence.order, currentSentence.text);
      const element = sentenceRefs.current.get(currentSentence.id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentTime, episode]);

  const loadEpisode = async () => {
    if (!episodeId) return;
    console.log('loadEpisode called for episodeId:', episodeId);
    try {
      const data = await getEpisode(episodeId);
      console.log('Episode loaded:', data);
      console.log('Episode audioUrl:', data.audioUrl);
      setEpisode(data);
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  };

  const selectVariation = (sentenceId: string, variationIndex: number) => {
    setSelectedVariations(new Map(selectedVariations.set(sentenceId, variationIndex)));
    setOpenSelector(null);
  };

  const toggleSelector = (sentenceId: string) => {
    setOpenSelector(openSelector === sentenceId ? null : sentenceId);
  };

  const getDisplayText = (sentence: Sentence): string => {
    const selectedIdx = selectedVariations.get(sentence.id);
    if (selectedIdx !== undefined && sentence.variations && sentence.variations[selectedIdx]) {
      return sentence.variations[selectedIdx];
    }
    return sentence.text;
  };

  const handleGenerateAudio = async () => {
    console.log('handleGenerateAudio called');
    if (!episode || !episode.dialogue) {
      console.log('No episode or dialogue');
      return;
    }

    console.log('Starting audio generation for episode:', episode.id, 'dialogue:', episode.dialogue.id);
    setIsGeneratingAudio(true);
    try {
      const jobId = await generateAudio(episode.id, episode.dialogue.id);
      console.log('Got job ID:', jobId);

      // Poll for completion
      await pollJobStatus(jobId, async (status) => {
        console.log('Job status:', status);
        if (status === 'completed') {
          // Reload episode to get audio URLs
          await loadEpisode();
        }
      }, 'audio');
    } catch (err) {
      console.error('Failed to generate audio:', err);
      alert('Failed to generate audio. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Episode Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-navy mb-2">{episode.title}</h1>
            <p className="text-gray-600 text-sm">
              Created {new Date(episode.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline text-sm">
              Edit
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio}
            >
              {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
            </button>
          </div>
        </div>

        {/* Speakers Legend */}
        <div className="flex gap-4 flex-wrap">
          {speakers.map((speaker) => (
            <div key={speaker.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: speaker.color }}
              />
              <span className="text-sm font-medium text-navy">
                {speaker.name}
              </span>
              <span className="text-xs text-gray-500">
                ({speaker.proficiency}, {speaker.tone})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Player */}
      {episode.audioUrl && (
        <div className="card bg-pale-sky">
          <h3 className="text-lg font-semibold text-navy mb-3">
            Episode Audio
          </h3>
          <audio
            ref={audioRef}
            controls
            className="w-full"
            src={episode.audioUrl}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Dialogue */}
      <div className="space-y-3">
        {sentences.map((sentence, index) => {
          const speaker = speakerMap.get(sentence.speakerId);
          if (!speaker) return null;

          const displayText = getDisplayText(sentence);
          const selectedIdx = selectedVariations.get(sentence.id);
          const isOpen = openSelector === sentence.id;
          const hasVariations = sentence.variations && sentence.variations.length > 0;

          // All options: original text + variations
          const allOptions = [sentence.text, ...(sentence.variations || [])];

          // Check if this sentence is currently being spoken
          const isCurrentlySpeaking =
            sentence.startTime !== undefined &&
            sentence.endTime !== undefined &&
            currentTime * 1000 >= sentence.startTime &&
            currentTime * 1000 < sentence.endTime;

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
              onClick={() => hasVariations && toggleSelector(sentence.id)}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy">
                        {speaker.name}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                        #{index + 1}
                      </span>
                      {selectedIdx !== undefined && (
                        <span className="text-xs px-2 py-1 bg-indigo text-white rounded">
                          Variation {selectedIdx + 1}
                        </span>
                      )}
                    </div>
                    {hasVariations && (
                      <div className="text-xs text-gray-400">
                        {isOpen ? '▲' : '▼'} {allOptions.length} options
                      </div>
                    )}
                </div>

                {/* Japanese Text */}
                <div>
                  <p className="text-2xl text-navy leading-relaxed">
                    <JapaneseText
                      text={displayText}
                      metadata={sentence.metadata}
                    />
                  </p>
                </div>

                {/* Translation */}
                <div className="border-t pt-2">
                  <p className="text-gray-600 italic">
                    {sentence.translation}
                  </p>
                </div>

                {/* Variation Selector */}
                {isOpen && hasVariations && (
                  <div
                    className="border-t pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Select a variation:
                    </p>
                    <div className="space-y-2">
                      {allOptions.map((option, optIdx) => {
                        const isSelected = selectedIdx === undefined
                          ? optIdx === 0
                          : selectedIdx === optIdx - 1;
                        const isOriginal = optIdx === 0;

                        return (
                          <div
                            key={optIdx}
                            onClick={() => {
                              if (isOriginal) {
                                // Remove selection to show original
                                const newMap = new Map(selectedVariations);
                                newMap.delete(sentence.id);
                                setSelectedVariations(newMap);
                                setOpenSelector(null);
                              } else {
                                selectVariation(sentence.id, optIdx - 1);
                              }
                            }}
                            className={`
                              text-sm px-3 py-2 rounded cursor-pointer transition-all
                              ${isSelected
                                ? 'bg-indigo text-white font-medium shadow-sm'
                                : 'text-gray-700 hover:bg-pale-sky hover:text-navy'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                <JapaneseText
                                  text={option}
                                  metadata={isOriginal
                                    ? sentence.metadata
                                    : sentence.variationsMetadata?.[optIdx - 1]
                                  }
                                />
                              </span>
                              {isOriginal && (
                                <span className="text-xs ml-2 opacity-75">
                                  (Original)
                                </span>
                              )}
                              {isSelected && (
                                <span className="ml-2">✓</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Story Source */}
      {episode.sourceText && (
        <div className="card bg-pale-sky">
          <h3 className="text-sm font-semibold text-navy mb-2">
            Original Story
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {episode.sourceText}
          </p>
        </div>
      )}
    </div>
  );
}
