import { useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import type { LearnPrompt } from './types';

const LearnSourceAudio = ({ source }: { source: LearnPrompt['sourceAudio'] }) => {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  if (!source) return null;
  const play = async () => {
    setError(false);
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.current?.play();
      setPlaying(true);
    } catch {
      setError(true);
    }
  };
  return (
    <div className="learn-source-audio">
      <audio
        ref={audio}
        src={source.url}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setError(true);
        }}
      />
      <button
        type="button"
        className="learn-button secondary"
        onClick={play}
        aria-label={`${playing ? 'Pause' : 'Play'} ${source.label}`}
      >
        {playing ? <Square size={18} /> : <Volume2 size={18} />} {source.label}
      </button>
      {error && <p role="alert">The book audio could not play. Try again.</p>}
    </div>
  );
};

export default LearnSourceAudio;
