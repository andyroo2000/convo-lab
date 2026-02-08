import { useState, useRef, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { voiceIdToFilename } from '@languageflow/shared/src/voiceSelection';

interface VoicePreviewProps {
  voiceId: string;
}

const VoicePreview = ({ voiceId }: VoicePreviewProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const filename = voiceIdToFilename(voiceId);
  const src = `/voice-previews/${filename}.mp3`;

  // Stop playback when voice changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    }
  }, [voiceId]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleEnded = () => setIsPlaying(false);

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
    >
      {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {isPlaying ? 'Stop' : 'Preview'}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="none" onEnded={handleEnded} />
    </button>
  );
};

export default VoicePreview;
