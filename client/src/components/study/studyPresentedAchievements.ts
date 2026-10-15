import type { StudyAchievementSessionStorage } from './studyAchievementSessionModel';

export const presentedAchievementStorageKey = (userId: string) =>
  `convo-lab.study-presented-achievements-v1.${encodeURIComponent(userId)}`;

// Independent of session and catalog revisions so reloads and late responses
// cannot resurrect an award that the learner already dismissed.
export class StudyPresentedAchievements {
  private readonly key: string;

  constructor(
    private readonly storage: StudyAchievementSessionStorage,
    userId: string
  ) {
    this.key = presentedAchievementStorageKey(userId);
  }

  read(): string[] {
    try {
      const value: unknown = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  acknowledge(ids: string[]): void {
    this.storage.setItem(this.key, JSON.stringify([...new Set([...this.read(), ...ids])]));
  }
}
