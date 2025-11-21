import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import AudioPlayer, { RepeatMode } from '../components/AudioPlayer';

import { API_URL } from '../config';

interface ChunkExample {
  id: string;
  order: number;
  sentence: string;
  english: string;
  contextNote?: string;
  audioUrl?: string; // Legacy field
  audioUrl_0_7?: string;
  audioUrl_0_85?: string;
  audioUrl_1_0?: string;
}

interface Chunk {
  id: string;
  form: string;
  translation: string;
  examples: ChunkExample[];
}

interface ChunkPack {
  id: string;
  title: string;
  chunks: Chunk[];
}

type PlaybackSpeed = 0.7 | 0.85 | 1.0;

export default function ChunkPackExamplesPage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentTime, audioRef, play, pause, isPlaying } = useAudioPlayer();
  const [pack, setPack] = useState<ChunkPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(0.85);
  const exampleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const shouldAutoPlay = useRef(false);

  // Flatten all examples with their chunk info
  const allExamples = pack?.chunks.flatMap(chunk =>
    chunk.examples.map(ex => ({ ...ex, chunkForm: chunk.form, chunkTranslation: chunk.translation }))
  ).filter(ex => ex.audioUrl) || [];

  // Find currently selected example
  const currentExampleIndex = allExamples.findIndex(ex => ex.id === selectedExampleId);
  const currentExample = currentExampleIndex >= 0 ? allExamples[currentExampleIndex] : null;

  // Get the audio URL for the current speed
  const getCurrentAudioUrl = (example: typeof allExamples[0] | null): string | undefined => {
    if (!example) return undefined;

    // Map speed to audio URL field
    if (playbackSpeed === 0.7) return example.audioUrl_0_7;
    if (playbackSpeed === 0.85) return example.audioUrl_0_85 || example.audioUrl; // Fallback to legacy
    if (playbackSpeed === 1.0) return example.audioUrl_1_0;

    return example.audioUrl_0_85 || example.audioUrl; // Default fallback
  };

  const currentAudioUrl = getCurrentAudioUrl(currentExample);

  useEffect(() => {
    fetchPack();
  }, [packId]);

  // Auto-select first example when pack loads
  useEffect(() => {
    if (pack && !selectedExampleId && allExamples.length > 0) {
      setSelectedExampleId(allExamples[0].id);
    }
  }, [pack]);

  const fetchPack = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chunk-packs/${packId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      setPack(data);
    } catch (err) {
      console.error('Failed to load pack:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-play when example changes (for sequential playback)
  useEffect(() => {
    if (!currentAudioUrl || !shouldAutoPlay.current) {
      shouldAutoPlay.current = false;
      return;
    }

    // Delay to ensure audio element is loaded and ready
    const timer = setTimeout(() => {
      console.log('Auto-playing next example:', currentExample?.sentence);
      play();
      shouldAutoPlay.current = false;
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedExampleId, currentAudioUrl, play]);

  const handleExampleClick = (exampleId: string) => {
    setSelectedExampleId(exampleId);
  };

  const handleAudioEnded = () => {
    console.log('Audio ended, current index:', currentExampleIndex, 'repeat mode:', repeatMode);
    if (!pack || currentExampleIndex < 0) return;

    // If repeat mode is 'one', replay the current example
    if (repeatMode === 'one') {
      const audio = audioRef as any;
      if (audio && audio.current) {
        audio.current.currentTime = 0;
        audio.current.play().catch((err: any) => console.error('Playback failed:', err));
      }
      return;
    }

    // If there's a next example, play it
    if (currentExampleIndex < allExamples.length - 1) {
      console.log('Advancing to next example');
      shouldAutoPlay.current = true;
      setSelectedExampleId(allExamples[currentExampleIndex + 1].id);
    } else if (repeatMode === 'all') {
      // Loop back to first example
      console.log('Looping back to first example');
      shouldAutoPlay.current = true;
      setSelectedExampleId(allExamples[0].id);
    }
  };

  // Handle spacebar to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause]);

  // Auto-scroll to currently selected example
  useEffect(() => {
    if (!selectedExampleId) return;

    const element = exampleRefs.current.get(selectedExampleId);
    if (element) {
      // Calculate the offset needed to position below the sticky headers
      // Header (105px) + Audio Player (~80px) + Chunk Header (~65px) + padding (20px) = ~270px
      const offset = 270;

      const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
      const scrollToPosition = elementTop - offset;

      window.scrollTo({
        top: scrollToPosition,
        behavior: 'smooth',
      });
    }
  }, [selectedExampleId]);

  // No longer need to set playbackRate since we're using pre-generated audio at different speeds

  if (loading || !pack) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate('/app/library')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-lg font-semibold text-navy">Step 1: Examples with Audio</h1>
            <div className="w-20" />
          </div>

          {/* Speed Control */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-600">Speed:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPlaybackSpeed(0.7)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  playbackSpeed === 0.7
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                0.7x
              </button>
              <button
                onClick={() => setPlaybackSpeed(0.85)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  playbackSpeed === 0.85
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                0.85x
              </button>
              <button
                onClick={() => setPlaybackSpeed(1.0)}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  playbackSpeed === 1.0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                1.0x
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Audio Player */}
      {currentAudioUrl && (
        <div className="sticky top-[105px] z-10 bg-white border-b shadow-md">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <AudioPlayer
              src={currentAudioUrl}
              audioRef={audioRef}
              repeatMode={repeatMode}
              onRepeatModeChange={setRepeatMode}
              onEnded={handleAudioEnded}
              key={currentAudioUrl}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="card bg-white shadow-xl mb-6">
          <h2 className="text-2xl font-bold text-navy mb-6">{pack.title}</h2>

          {/* Examples by Chunk */}
          <div className="space-y-8">
            {pack.chunks.map((chunk, chunkIndex) => (
              <div key={chunk.id} className="relative">
                {/* Sticky Chunk Header */}
                <div
                  className="sticky top-[170px] z-[5] bg-white border-l-4 border-emerald-500 pl-4 py-3 mb-4"
                  style={{
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <h3 className="text-xl font-bold text-navy mb-1">{chunk.form}</h3>
                  <p className="text-sm text-gray-600">{chunk.translation}</p>
                </div>

                {/* Examples */}
                <div className="space-y-3 pl-4">
                  {chunk.examples.map((example) => {
                    const isSelected = selectedExampleId === example.id;

                    return (
                      <div
                        key={example.id}
                        ref={(el) => {
                          if (el) exampleRefs.current.set(example.id, el);
                          else exampleRefs.current.delete(example.id);
                        }}
                        onClick={() => example.audioUrl && handleExampleClick(example.id)}
                        className={`rounded-lg p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-2 border-emerald-300'
                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                        }`}
                      >
                        {example.contextNote && (
                          <p className="text-xs text-gray-500 mb-2 italic">{example.contextNote}</p>
                        )}

                        <div>
                          <p className="text-lg text-gray-900 mb-1">{example.sentence}</p>
                          <p className="text-sm text-gray-600">{example.english}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="card bg-white shadow-xl">
          <button
            onClick={() => navigate(`/app/chunk-packs/${packId}/story`)}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            Next: Story
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
