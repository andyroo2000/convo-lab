import { useState } from 'react';

type Version = 'draft' | 'final';
export const journalVersionPrefix = (ownerId: string) =>
  `convolab:journal-version:${encodeURIComponent(ownerId)}:`;

function readVersion(key: string): Version | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'draft' || value === 'final' ? value : null;
  } catch {
    return null;
  }
}

export function rememberJournalVersion(ownerId: string, entryId: string, value: Version) {
  const key = `${journalVersionPrefix(ownerId)}${encodeURIComponent(entryId)}`;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep the picker usable when browser storage is unavailable.
  }
}

export default function useJournalVersion(ownerId: string, entryId: string, hasFinal: boolean) {
  const key = `${journalVersionPrefix(ownerId)}${encodeURIComponent(entryId)}`;
  const [selection, setSelection] = useState(() => ({ key, value: readVersion(key) }));
  if (selection.key !== key) setSelection({ key, value: readVersion(key) });
  const selected = selection.key === key ? selection.value : readVersion(key);
  const version = hasFinal ? (selected ?? 'draft') : 'draft';
  const changeVersion = (value: Version) => {
    setSelection({ key, value });
    rememberJournalVersion(ownerId, entryId, value);
  };
  return [version, changeVersion] as const;
}
