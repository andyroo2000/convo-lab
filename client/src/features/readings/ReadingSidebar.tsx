import type { ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import type { ReadingSentence } from './types';
import type useReadingAudio from './useReadingAudio';

interface Props {
  children: ReactNode;
  sentence: ReadingSentence | null;
  voice: string;
  audio: ReturnType<typeof useReadingAudio>;
}

const ReadingSidebar = ({ sentence, voice, audio, children }: Props) => (
  <aside className="translation-panel" aria-label="Sentence translation">
    {children}
    <h2>Translation</h2>
    {!sentence ? (
      <p className="panel-empty">Select a sentence to read its meaning and listen.</p>
    ) : (
      <>
        <div className="sidebar-playback">
          <button
            type="button"
            onClick={() => {
              audio.toggle();
            }}
            disabled={audio.status === 'loading'}
            aria-label={audio.status === 'playing' ? 'Pause sentence' : 'Play sentence'}
            aria-keyshortcuts="Space"
          >
            {audio.status === 'playing' ? <Pause size={16} /> : <Play size={16} />}
            {audio.status === 'loading' ? 'Preparing…' : voice}
          </button>
          <span className="shortcut-hint">Space · play / pause</span>
        </div>
        {audio.status === 'error' && <p role="alert">Audio unavailable. Try playing again.</p>}
        <div aria-live="polite">
          <p className="panel-japanese" lang="ja">
            {sentence.text}
          </p>
          <p>{sentence.translation}</p>
        </div>
      </>
    )}
  </aside>
);

export default ReadingSidebar;
