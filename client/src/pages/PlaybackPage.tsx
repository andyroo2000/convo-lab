import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { Episode, Sentence, Speaker } from '../types';
import JapaneseText from '../components/JapaneseText';

export default function PlaybackPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { getEpisode, loading } = useEpisodes();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Map<string, number>>(new Map());
  const [openSelector, setOpenSelector] = useState<string | null>(null);

  useEffect(() => {
    if (episodeId) {
      loadEpisode();
    }
  }, [episodeId]);

  const loadEpisode = async () => {
    if (!episodeId) return;
    try {
      const data = await getEpisode(episodeId);
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
            <button className="btn-primary text-sm">
              Generate Audio
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

          return (
            <div
              key={sentence.id}
              className="card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => hasVariations && toggleSelector(sentence.id)}
            >
              <div className="flex items-start gap-4">
                {/* Speaker indicator */}
                <div
                  className="w-1 h-full rounded-full flex-shrink-0"
                  style={{ backgroundColor: speaker.color }}
                />

                <div className="flex-1 space-y-3">
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
                                    metadata={sentence.metadata}
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
