import { useEffect, type RefObject } from 'react';

function isPlaybackTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;
  if (target.closest('dialog, [role="dialog"], [contenteditable]:not([contenteditable="false"])'))
    return false;
  const control = target.closest('input, textarea, select, button, a, [role="button"]');
  return !control || control.hasAttribute('data-journal-playback-control');
}

function isSpace(event: KeyboardEvent) {
  return event.code === 'Space' || event.key === ' ';
}

function acceptsShortcut(event: KeyboardEvent) {
  if (!isSpace(event)) return false;
  const modified = [event.repeat, event.altKey, event.ctrlKey, event.metaKey, event.shiftKey].some(
    Boolean
  );
  return !modified && isPlaybackTarget(event.target);
}

export default function useJournalSpacebar(player: RefObject<HTMLAudioElement | null>) {
  useEffect(() => {
    let awaitingRelease = false;
    const reset = () => {
      awaitingRelease = false;
    };
    const release = (event: KeyboardEvent) => {
      if (!awaitingRelease || !isSpace(event)) return;
      reset();
      event.preventDefault();
      event.stopPropagation();
    };
    const pause = (event: KeyboardEvent) => {
      const audio = player.current;
      if (!audio) return;
      if (audio.paused || audio.ended) return;
      if (!acceptsShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      awaitingRelease = true;
      audio.pause();
    };
    document.addEventListener('keydown', pause, true);
    document.addEventListener('keyup', release, true);
    window.addEventListener('blur', reset);
    return () => {
      document.removeEventListener('keydown', pause, true);
      document.removeEventListener('keyup', release, true);
      window.removeEventListener('blur', reset);
    };
  }, [player]);
}
