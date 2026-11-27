import { useEffect, useState } from 'react';

interface Draft {
  text: string;
}

function readDraft(key: string): Draft {
  const fallback: Draft = { text: '' };
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (typeof saved?.text !== 'string') return fallback;
    return { text: saved.text };
  } catch {
    return fallback;
  }
}

export function clearLessonDrafts(prefix: string) {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* Storage may be unavailable; the visible composer still resets. */
  }
}

export default function useLearnDraft(storageKey: string) {
  const [draft, setDraft] = useState(() => readDraft(storageKey));
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* Keep the in-memory draft. */
    }
  }, [storageKey, draft]);
  return {
    ...draft,
    setText: (text: string) => setDraft((current) => ({ ...current, text })),
  };
}
