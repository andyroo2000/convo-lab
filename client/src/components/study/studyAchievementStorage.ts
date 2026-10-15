import type { StudyAchievementSessionStorage } from './studyAchievementSessionModel';

// Keep the current page usable when browser storage is unavailable or full.
// Unsaved writes take precedence over older persisted values on this page.
const resilientAchievementStorage = (
  storage: StudyAchievementSessionStorage
): StudyAchievementSessionStorage => {
  const fallback = new Map<string, string | null>();
  const unsaved = new Set<string>();

  const write = (key: string, value: string | null) => {
    fallback.set(key, value);
    unsaved.add(key);
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
      unsaved.delete(key);
    } catch {
      // Dismissing a celebration must still work; persistence is best-effort.
    }
  };

  return {
    getItem: (key) => {
      if (unsaved.has(key)) return fallback.get(key) ?? null;
      try {
        const value = storage.getItem(key);
        fallback.set(key, value);
        return value;
      } catch {
        return fallback.get(key) ?? null;
      }
    },
    setItem: write,
    removeItem: (key) => write(key, null),
  };
};

export default resilientAchievementStorage;
