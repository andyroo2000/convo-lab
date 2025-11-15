import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { Episode, Sentence, Speaker, AudioSpeed } from '../types';
import JapaneseText from '../components/JapaneseText';
import AudioPlayer from '../components/AudioPlayer';

export default function PlaybackPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { getEpisode, generateAudio, pollJobStatus, loading } = useEpisodes();
  const { audioRef, currentTime, isPlaying, seek, play, pause } = useAudioPlayer();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<AudioSpeed>('medium');
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());


  useEffect(() => {
    if (episodeId) {
      loadEpisode();
    }
  }, [episodeId]);

  // Initialize selectedSpeed from episode data
  useEffect(() => {
    if (episode?.audioSpeed) {
      setSelectedSpeed(episode.audioSpeed as AudioSpeed);
    }
  }, [episode]);

  // Keyboard controls: Space bar to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle space bar
      if (e.code !== 'Space') return;

      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Prevent default scroll behavior
      e.preventDefault();

      // Toggle play/pause
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause]);

  // Auto-scroll to currently playing sentence
  useEffect(() => {
    if (!episode?.dialogue?.sentences) return;

    const currentSentence = episode.dialogue.sentences.find(
      (sentence) => {
        return sentence.startTime !== undefined &&
          sentence.endTime !== undefined &&
          currentTime * 1000 >= sentence.startTime &&
          currentTime * 1000 < sentence.endTime;
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
  }, [currentTime, episode]);

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
    if (sentence.startTime !== undefined) {
      // Convert milliseconds to seconds
      seek(sentence.startTime / 1000);
      // Play if not already playing
      if (!isPlaying) {
        play();
      }
    }
  };

  const handleGenerateAudio = async () => {
    if (!episode || !episode.dialogue) return;

    setIsGeneratingAudio(true);
    try {
      const jobId = await generateAudio(episode.id, episode.dialogue.id, selectedSpeed);

      // Poll for completion
      await pollJobStatus(jobId, async (status) => {
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

  // Check if speed has changed from episode's saved speed
  const hasSpeedChanged = selectedSpeed !== (episode.audioSpeed || 'medium');

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
          <div className="flex gap-3 items-end">
            {/* Speed Selector */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Audio Speed</label>
              <select
                value={selectedSpeed}
                onChange={(e) => setSelectedSpeed(e.target.value as AudioSpeed)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo"
              >
                <option value="very-slow">Very Slow</option>
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleGenerateAudio}
              disabled={isGeneratingAudio || (!hasSpeedChanged && !!episode.audioUrl)}
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

      {/* Audio Player - Sticky */}
      {episode.audioUrl && (
        <div className="sticky top-0 z-10 card bg-pale-sky py-3 px-4 shadow-md">
          <AudioPlayer
            src={episode.audioUrl}
            audioRef={audioRef}
            key={episode.audioUrl}
          />
        </div>
      )}

      {/* Dialogue */}
      <div className="space-y-3">
        {sentences.map((sentence, index) => {
          const speaker = speakerMap.get(sentence.speakerId);
          if (!speaker) return null;

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
              onClick={() => seekToSentence(sentence)}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy">
                    {speaker.name}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                    #{index + 1}
                  </span>
                </div>

                {/* Japanese Text and Translation - Side by Side */}
                <div className="flex gap-0 py-3">
                  {/* Japanese Text - Left Column */}
                  <div className="flex-1 pr-6">
                    <p className="text-2xl text-navy leading-relaxed">
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
  );
}
