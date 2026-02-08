import { useState, useRef, useEffect, memo } from 'react';
import { Play, Square } from 'lucide-react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { voiceIdToFilename } from '@languageflow/shared/src/voiceSelection';
import { useAudioPreview } from '../../contexts/AudioPreviewContext';

interface VoicePreviewProps {
  voiceId: string;
}

const VoicePreview = ({ voiceId }: VoicePreviewProps) => {
  const { play, stop, currentSrc, isPlaying: contextPlaying } = useAudioPreview();
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const placeholderRef = useRef<HTMLSpanElement>(null);

  const filename = voiceIdToFilename(voiceId);
  const src = `/voice-previews/${filename}.mp3`;
  const isThisPlaying = currentSrc === src && contextPlaying;

  // Reset error state when voice changes
  useEffect(() => {
    setHasError(false);
  }, [voiceId]);

  // Stop playback of this voice when voiceId changes
  useEffect(
    () => () => {
      stop();
    },
    // Only run cleanup when voiceId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceId]
  );

  // Lazy loading: only render when visible
  useEffect(() => {
    const el = isVisible ? null : placeholderRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  const toggle = async () => {
    if (isThisPlaying) {
      stop();
    } else {
      try {
        await play(src);
      } catch {
        setHasError(true);
      }
    }
  };

  if (hasError) {
    return <span className="text-xs text-gray-400 mt-1.5">Preview unavailable</span>;
  }

  if (!isVisible) {
    return <span ref={placeholderRef} className="inline-block mt-1.5 h-6" />;
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={isThisPlaying ? 'Stop voice sample' : 'Preview voice sample'}
      className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
    >
      {isThisPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      {isThisPlaying ? 'Stop' : 'Preview'}
    </button>
  );
};

export default memo(VoicePreview, (prev, next) => prev.voiceId === next.voiceId);
