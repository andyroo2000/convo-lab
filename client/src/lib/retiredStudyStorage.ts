// Upgrade cleanup only: award state is no longer read or written by the app.
export const clearRetiredStudyStorage = (storage: Storage) => {
  const prefixes = ['convo-lab.study-achievement-sessions-v1.', 'convo-lab.study-milestones-v1.'];
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
};

export const clearRetiredBrowserStudyStorage = () => {
  try {
    clearRetiredStudyStorage(window.localStorage);
  } catch {
    // Private browsing or blocked storage must not prevent authentication.
  }
};
