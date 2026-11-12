const pendingPrefix = 'convolab:journal-account-deletion:';

function keys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key !== null
  );
}

export function removeJournalDeviceData(ownerId: string, entryId?: string, storage = localStorage) {
  const draftPrefix = `convolab:journal:v1:${encodeURIComponent(ownerId)}:`;
  const answerPrefix = `convolab:journal-answer:${ownerId}:`;
  keys(storage).forEach((key) => {
    const isDraft = entryId ? key === `${draftPrefix}${entryId}` : key.startsWith(draftPrefix);
    const isAnswer = key.startsWith(entryId ? `${answerPrefix}${entryId}:` : answerPrefix);
    if (isDraft || isAnswer) storage.removeItem(key);
  });
}

export function removeDeletedAccountJournal(ownerId: string, storage = localStorage) {
  const marker = `${pendingPrefix}${ownerId}`;
  try {
    storage.setItem(marker, 'pending');
  } catch {
    // A full store may reject new keys while still allowing private data removal.
    console.warn('Could not persist the journal cleanup marker; attempting cleanup now.');
  }
  removeJournalDeviceData(ownerId, undefined, storage);
  storage.removeItem(marker);
}

export function retryJournalDeviceCleanup(storage = localStorage) {
  keys(storage)
    .filter((key) => key.startsWith(pendingPrefix))
    .forEach((marker) => {
      removeDeletedAccountJournal(marker.slice(pendingPrefix.length), storage);
    });
}
