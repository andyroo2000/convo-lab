// One atomic record contains every file produced by AzooKey's learning writer.
// Never send this device-local history to the playground server.
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('convolab-japanese-learning', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('memory');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadLearning() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('memory').objectStore('memory').get('files');
      request.onsuccess = () => resolve(request.result ?? { files: [], revision: 0 });
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
export async function saveLearning(files, expectedRevision) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let revision, conflict;
      const transaction = database.transaction('memory', 'readwrite');
      const store = transaction.objectStore('memory');
      const current = store.get('files');
      current.onsuccess = () => {
        const previous = current.result?.revision ?? 0;
        if (expectedRevision !== null && previous !== expectedRevision) {
          conflict = Error('Learning changed in another tab. Retry the keyboard to refresh it.');
          transaction.abort();
          return;
        }
        revision = previous + 1;
        store.put({ files, revision }, 'files');
      };
      transaction.oncomplete = () => resolve(revision);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(conflict ?? transaction.error ?? Error('Learning storage was interrupted'));
    });
  } finally {
    database.close();
  }
}
