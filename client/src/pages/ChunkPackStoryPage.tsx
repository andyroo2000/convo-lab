import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader } from 'lucide-react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getSpeakerColor } from '@languageflow/shared/src/constants-new';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

import { API_URL } from '../config';

interface ChunkStorySegment {
  id: string;
  order: number;
  japaneseText: string;
  englishTranslation: string;
  audioUrl?: string;
  startTime?: number;
  endTime?: number;
}

interface ChunkStory {
  id: string;
  title: string;
  storyText: string;
  english: string;
  audioUrl?: string;
  segments: ChunkStorySegment[];
}

interface Speaker {
  name: string;
  color: string;
}

const ChunkPackStoryPage = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { audioRef, currentTime, seek, play } = useAudioPlayer();
  const [story, setStory] = useState<ChunkStory | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [speakers, setSpeakers] = useState<Map<string, Speaker>>(new Map());
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    fetchStory();
  }, [packId]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!story?.segments) return;

    const currentSegment = story.segments.find(
      (segment) =>
        segment.startTime !== undefined &&
        segment.endTime !== undefined &&
        currentTime * 1000 >= segment.startTime &&
        currentTime * 1000 < segment.endTime
    );

    if (currentSegment) {
      const element = sentenceRefs.current.get(currentSegment.id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentTime, story]);

  const fetchStory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chunk-packs/${packId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.stories && data.stories.length > 0) {
        const storyData = data.stories[0];
        setStory(storyData);

        // Parse speakers from segments
        const speakerColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']; // Blue, Green, Amber, Red
        const speakerMap = new Map<string, Speaker>();
        let colorIndex = 0;

        storyData.segments.forEach((segment: ChunkStorySegment) => {
          const speakerMatch = segment.japaneseText.match(/^([^：:]+)[：:]/);
          if (speakerMatch) {
            const speakerName = speakerMatch[1].trim();
            if (!speakerMap.has(speakerName)) {
              speakerMap.set(speakerName, {
                name: speakerName,
                color: speakerColors[colorIndex % speakerColors.length],
              });
              colorIndex += 1;
            }
          }
        });

        setSpeakers(speakerMap);
      } else {
        // No stories yet - set empty story object to stop spinner
        setStory({
          id: '',
          title: '',
          storyText: '',
          english: '',
          segments: [],
        });
      }
    } catch (err) {
      console.error('Failed to load story:', err);
      // Set empty story to stop spinner on error
      setStory({
        id: '',
        title: '',
        storyText: '',
        english: '',
        segments: [],
      });
    }
  };

  const seekToSegment = (segment: ChunkStorySegment) => {
    if (segment.startTime !== undefined) {
      seek(segment.startTime / 1000);
      play();
    }
  };

  // Extract speaker name and text from segment
  const parseSegmentText = (japaneseText: string) => {
    const speakerMatch = japaneseText.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (speakerMatch) {
      return {
        speaker: speakerMatch[1].trim(),
        text: speakerMatch[2].trim(),
      };
    }
    return {
      speaker: null,
      text: japaneseText,
    };
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Show message if no story exists yet
  if (story.segments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <h1 className="text-base sm:text-lg font-semibold text-navy">Step 2: Story</h1>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-white rounded-lg p-6 sm:p-12 text-center shadow-sm">
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              Story generation is not yet implemented for this pack.
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              You can proceed to the exercises step.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/app/chunk-packs/${packId}/exercises`)}
              className="mt-4 sm:mt-6 btn-primary"
            >
              Continue to Exercises
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              type="button"
              onClick={() => navigate(`/app/chunk-packs/${packId}/examples`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Back</span>
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-navy">Step 2: Story</h1>
            <div className="w-12 sm:w-20" />
          </div>

          {/* Title and Controls */}
          <div className="mb-3 sm:mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-navy mb-2 sm:mb-3">{story.title}</h2>
            <button
              type="button"
              onClick={() => setShowEnglish(!showEnglish)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-medium"
            >
              {showEnglish ? 'Hide' : 'Show'} English
            </button>
          </div>

          {/* Speakers Legend */}
          {speakers.size > 0 && (
            <div className="flex gap-3 sm:gap-4 flex-wrap">
              {Array.from(speakers.values()).map((speaker, index) => (
                <div key={speaker.name} className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                    style={{ backgroundColor: getSpeakerColor(index) }}
                  />
                  <span className="text-xs sm:text-sm font-medium text-navy">{speaker.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Audio Player */}
      {story.audioUrl && (
        <div className="sticky top-[140px] sm:top-[180px] z-10 max-w-4xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="card bg-white shadow-lg py-2 sm:py-3 px-3 sm:px-4">
            <AudioPlayer src={story.audioUrl} audioRef={audioRef} key={story.audioUrl} />
          </div>
        </div>
      )}

      {/* Dialogue Segments */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {story.segments.map((segment, index) => {
            const parsed = parseSegmentText(segment.japaneseText);
            const speaker = parsed.speaker ? speakers.get(parsed.speaker) : null;
            const speakerColor = speaker?.color || '#6B7280'; // Default gray

            // Check if this segment is currently being spoken
            const isCurrentlySpeaking =
              segment.startTime !== undefined &&
              segment.endTime !== undefined &&
              currentTime * 1000 >= segment.startTime &&
              currentTime * 1000 < segment.endTime;

            return (
              <div
                key={segment.id}
                ref={(el) => {
                  if (el) sentenceRefs.current.set(segment.id, el);
                  else sentenceRefs.current.delete(segment.id);
                }}
                className={`card hover:shadow-md transition-all duration-300 cursor-pointer ${
                  isCurrentlySpeaking ? 'shadow-lg' : ''
                }`}
                style={{
                  backgroundColor: hexToRgba(speakerColor, isCurrentlySpeaking ? 0.18 : 0.08),
                  borderLeft: `${isCurrentlySpeaking ? '6px' : '4px'} solid ${speakerColor}`,
                  borderRight: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                  borderTop: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                  borderBottom: isCurrentlySpeaking ? `3px solid ${speakerColor}` : undefined,
                }}
                onClick={() => seekToSegment(segment)}
                onKeyDown={(e) => e.key === 'Enter' && seekToSegment(segment)}
                role="button"
                tabIndex={0}
              >
                <div className="space-y-2 sm:space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {speaker && (
                      <span className="text-sm sm:text-base font-semibold text-navy">
                        {speaker.name}
                      </span>
                    )}
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-gray-600">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Japanese Text */}
                  <div>
                    <p className="text-lg sm:text-2xl text-navy leading-relaxed">{parsed.text}</p>
                  </div>

                  {/* English Translation */}
                  {showEnglish && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-sm sm:text-base text-gray-700">
                        {segment.englishTranslation.replace(/^[^：:]+[：:]\s*/, '')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Next Button */}
        <div className="card bg-white shadow-xl">
          <button
            type="button"
            onClick={() => navigate(`/app/chunk-packs/${packId}/exercises`)}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            Next: Exercises
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChunkPackStoryPage;
