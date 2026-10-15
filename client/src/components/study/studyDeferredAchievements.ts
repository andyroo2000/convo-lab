import { StudyPresentedAchievements } from './studyPresentedAchievements';
import type { AchievementAward } from './achievementModel';
import type {
  StudyAchievementSessionCompletion,
  StudyAchievementRefresh,
  StudyAchievementSessionStorage,
} from './studyAchievementSessionModel';

export interface DeferredAchievementSession {
  id: string;
  revision: number;
  baselineAwardIds: string[];
  baselineKnown?: boolean;
  newAwardIds: string[];
  needsRefresh: boolean;
}

export const deferredAchievementStorageKey = (userId: string) =>
  `convo-lab.study-deferred-achievements-v1.${encodeURIComponent(userId)}`;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isDeferredSession = (value: DeferredAchievementSession) =>
  value &&
  typeof value.id === 'string' &&
  Number.isInteger(value.revision) &&
  isStringArray(value.baselineAwardIds) &&
  isStringArray(value.newAwardIds) &&
  typeof value.needsRefresh === 'boolean';

const excludeAwards = (session: DeferredAchievementSession, ids: string[]) => {
  const baseline = new Set([...session.baselineAwardIds, ...ids]);
  Object.assign(session, {
    baselineAwardIds: [...baseline],
    newAwardIds: session.newAwardIds.filter((id) => !baseline.has(id)),
  });
};

const evaluateSession = (session: DeferredAchievementSession, awards: AchievementAward[]) => {
  if (session.baselineKnown === false) {
    excludeAwards(
      session,
      awards.map(({ id }) => id)
    );
    Object.assign(session, { baselineKnown: true });
  }
  const baseline = new Set(session.baselineAwardIds);
  const detected = awards
    .filter(({ id }) => !baseline.has(id))
    .sort((left, right) => Date.parse(left.earnedAt) - Date.parse(right.earnedAt))
    .map(({ id }) => id);
  Object.assign(session, {
    newAwardIds: [...new Set([...session.newAwardIds, ...detected])],
    needsRefresh: false,
  });
};

export class StudyDeferredAchievements {
  private readonly key: string;

  private readonly presented: StudyPresentedAchievements;

  constructor(
    private readonly storage: StudyAchievementSessionStorage,
    userId: string
  ) {
    this.key = deferredAchievementStorageKey(userId);
    this.presented = new StudyPresentedAchievements(storage, userId);
  }

  enqueue(session: DeferredAchievementSession): void {
    this.save([...this.load().filter(({ id }) => id !== session.id), session]);
  }

  refreshBaseline(sessionId: string, awards: AchievementAward[]): void {
    const sessions = this.load();
    const session = sessions.find(({ id }) => id === sessionId);
    if (!session) return;
    Object.assign(session, { baselineKnown: true });
    excludeAwards(
      session,
      awards.map(({ id }) => id)
    );
    this.save(sessions);
  }

  settle(refresh: StudyAchievementRefresh, awards: AchievementAward[]): void {
    const sessions = this.load();
    const session = sessions.find(({ id }) => id === refresh.sessionId);
    if (!session || session.revision !== refresh.revision) return;
    evaluateSession(session, awards);
    this.save(sessions);
  }

  recover(awards: AchievementAward[]): StudyAchievementSessionCompletion | null {
    const sessions = this.load();
    sessions
      .filter(({ needsRefresh }) => needsRefresh)
      .forEach((session) => evaluateSession(session, awards));
    const presented = this.presented.read();
    sessions.forEach((session) => excludeAwards(session, presented));
    this.save(sessions);
    const session = sessions.find(({ newAwardIds }) => newAwardIds.length > 0);
    if (!session) return null;
    return {
      id: session.id,
      records: [],
      newAwardIds: session.newAwardIds,
      celebrationPresented: false,
    };
  }

  acknowledge(awardIds: string[]): void {
    const sessions = this.load();
    sessions.forEach((session) => excludeAwards(session, awardIds));
    this.save(sessions);
  }

  markPresented(sessionId: string): string[] {
    const ids = this.load().find(({ id }) => id === sessionId)?.newAwardIds ?? [];
    this.presented.acknowledge(ids);
    this.acknowledge(ids);
    return ids;
  }

  private load(): DeferredAchievementSession[] {
    // Read at each mutation so an old page's late response cannot overwrite a
    // newer page's pending completions with an in-memory snapshot.
    try {
      const value: unknown = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      return Array.isArray(value) ? value.filter(isDeferredSession) : [];
    } catch {
      return [];
    }
  }

  private save(sessions: DeferredAchievementSession[]): void {
    const pending = sessions.filter(
      (session) => session.needsRefresh || session.newAwardIds.length > 0
    );
    this.storage.setItem(this.key, JSON.stringify(pending));
  }
}
