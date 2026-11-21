import { useSyncExternalStore } from 'react';

export type KeyboardMode = 'built-in' | 'device';
const key = 'convolab:journal-keyboard:v1';
const eventName = 'journal-keyboard-changed';
let remembered: KeyboardMode | null = null;

function read(): KeyboardMode | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'built-in' || value === 'device' ? value : remembered;
  } catch {
    return remembered;
  }
}
function subscribe(notify: () => void) {
  window.addEventListener(eventName, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener('storage', notify);
  };
}
export function saveKeyboardMode(mode: KeyboardMode) {
  remembered = mode;
  try {
    localStorage.setItem(key, mode);
  } catch {
    // Keep the choice for this visit when device storage is unavailable.
  }
  window.dispatchEvent(new Event(eventName));
}
export function useKeyboardMode() {
  return useSyncExternalStore(subscribe, read, () => null);
}
