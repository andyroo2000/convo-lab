import { useEffect } from 'react';

interface ReadingKeyboardOptions {
  selected: number | null;
  toggleAudio: () => void;
  turnPage: (direction: number) => void;
}

function shouldIgnoreKey(event: KeyboardEvent) {
  if ([event.defaultPrevented, event.altKey, event.ctrlKey, event.metaKey].some(Boolean))
    return true;
  const { target } = event;
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]'))
    return true;
  const control = target.closest('a, button, [role="button"], summary');
  return Boolean(control && !control.matches('.reading-segment, .reader-pagination button'));
}

export default function useReadingKeyboard({
  selected,
  toggleAudio,
  turnPage,
}: ReadingKeyboardOptions) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (shouldIgnoreKey(event)) return;
      const actions: Record<string, (() => void) | undefined> = {
        ArrowLeft: () => turnPage(1),
        ArrowRight: () => turnPage(-1),
        ' ': selected === null ? undefined : toggleAudio,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) action();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected, toggleAudio, turnPage]);
}
