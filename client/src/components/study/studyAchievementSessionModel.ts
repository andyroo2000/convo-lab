import type { AchievementAward } from './achievementModel';
import type { StudySessionReviewRecord } from './studySessionWrapUpModel';
import {
  deferredAchievementStorageKey,
  StudyDeferredAchievements,
} from './studyDeferredAchievements';

export interface StudyAchievementSessionCompletion {
  id: string;
  records: StudySessionReviewRecord[];
  newAwardIds: string[];
  celebrationPresented: boolean;
}

type SessionReference = Pick<StudyAchievementSessionCompletion, 'id'>;

export interface StudyAchievementRefresh {
  sessionId: string;
  revision: number;
}

export interface StudyAchievementSessionStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface PersistedAchievementSession {
  id: string;
  records: StudySessionReviewRecord[];
  baselineAwardIds: string[];
  newAwardIds: string[];
  isReadyForPresentation: boolean;
  celebrationPresented: boolean;
  refreshRevision: number;
  refreshCompleted: boolean;
}

interface PersistedAchievementSessionState {
  activeSession: PersistedAchievementSession | null;
}

const detectAwardIds = (session: PersistedAchievementSession, awards: AchievementAward[]) => {
  const baseline = new Set(session.baselineAwardIds);
  return awards
    .filter(({ id }) => !baseline.has(id))
    .sort((left, right) => Date.parse(left.earnedAt) - Date.parse(right.earnedAt))
    .map(({ id }) => id);
};

const emptyState = (): PersistedAchievementSessionState => ({ activeSession: null });

export const studyAchievementSessionStorageKey = (userId: string) =>
  `convo-lab.study-achievement-sessions-v1.${encodeURIComponent(userId)}`;

export const deleteStudyAchievementSessionData = (
  storage: StudyAchievementSessionStorage,
  userId: string
) => {
  storage.removeItem(studyAchievementSessionStorageKey(userId));
  storage.removeItem(deferredAchievementStorageKey(userId));
  storage.removeItem(`convo-lab.study-milestones-v1.${encodeURIComponent(userId)}`);
};

const stringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;

const completedRefresh = (session: PersistedAchievementSession) => {
  if (typeof session.refreshCompleted === 'boolean') return session.refreshCompleted;
  // Legacy celebrations were frozen once presented; do not attach later awards
  // to those already-finished sessions when upgrading the saved state.
  return session.celebrationPresented === true;
};

const decodeSession = (
  session: PersistedAchievementSession | null | undefined
): PersistedAchievementSession | null => {
  if (!session || typeof session !== 'object') return null;
  const baselineAwardIds = stringArray(session.baselineAwardIds);
  const newAwardIds = stringArray(session.newAwardIds);
  if (typeof session.id !== 'string') return null;
  if (!Array.isArray(session.records)) return null;
  if (baselineAwardIds === null || newAwardIds === null) return null;
  return {
    id: session.id,
    records: session.records,
    baselineAwardIds,
    newAwardIds,
    isReadyForPresentation: session.isReadyForPresentation === true,
    celebrationPresented: session.celebrationPresented === true,
    refreshRevision: Number.isSafeInteger(session.refreshRevision) ? session.refreshRevision : 0,
    refreshCompleted: completedRefresh(session),
  };
};

const loadState = (
  storage: StudyAchievementSessionStorage,
  userId: string
): PersistedAchievementSessionState => {
  const raw = storage.getItem(studyAchievementSessionStorageKey(userId));
  if (!raw) return emptyState();

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAchievementSessionState>;
    return { activeSession: decodeSession(parsed.activeSession) };
  } catch {
    return emptyState();
  }
};

interface StudyAchievementSessionStoreOptions {
  createId?: () => string;
}

const prepareLateAwards = (
  session: PersistedAchievementSession,
  awards: AchievementAward[]
): void => {
  if (!session.celebrationPresented) return;
  if (detectAwardIds(session, awards).length === 0) return;
  Object.assign(session, { newAwardIds: [], celebrationPresented: false });
};

export class StudyAchievementSessionStore {
  private state: PersistedAchievementSessionState;

  private readonly createId: () => string;

  private readonly deferred: StudyDeferredAchievements;

  constructor(
    private readonly storage: StudyAchievementSessionStorage,
    private readonly userId: string,
    options: StudyAchievementSessionStoreOptions = {}
  ) {
    this.createId =
      options.createId ??
      (() =>
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    this.state = loadState(storage, userId);
    this.deferred = new StudyDeferredAchievements(storage, userId);
  }

  beginReviewSession(currentAwards: AchievementAward[]): string | null {
    if (this.state.activeSession?.isReadyForPresentation) return null;
    this.state.activeSession = {
      id: this.createId(),
      records: [],
      baselineAwardIds: currentAwards.map(({ id }) => id),
      newAwardIds: [],
      isReadyForPresentation: false,
      celebrationPresented: false,
      refreshRevision: 0,
      refreshCompleted: false,
    };
    this.persist();
    return this.state.activeSession.id;
  }

  recordReview(record: StudySessionReviewRecord): void {
    const session = this.state.activeSession;
    if (!session || session.isReadyForPresentation) return;
    session.records = [...session.records.filter(({ id }) => id !== record.id), record];
    this.persist();
  }

  refreshCurrentSessionBaseline(currentAwards: AchievementAward[]): void {
    this.refreshBaselineIds(currentAwards.map(({ id }) => id));
  }

  private refreshBaselineIds(awardIds: string[]): void {
    const session = this.state.activeSession;
    if (!session) return;
    const baseline = new Set([...session.baselineAwardIds, ...awardIds]);
    session.baselineAwardIds = [...baseline];
    session.newAwardIds = session.newAwardIds.filter((id) => !baseline.has(id));
    this.persist();
  }

  undoReview(reviewId: string): void {
    const session = this.state.activeSession;
    if (!session || session.isReadyForPresentation) return;
    session.records = session.records.filter(({ id }) => id !== reviewId);
    this.persist();
  }

  prepareCurrentSessionCompletion(
    currentAwards: AchievementAward[]
  ): StudyAchievementSessionCompletion | null {
    return this.prepareCompletion(currentAwards, false);
  }

  prepareInterruptedCompletion(
    currentAwards: AchievementAward[]
  ): StudyAchievementSessionCompletion | null {
    return this.deferred.recover(currentAwards) ?? this.prepareCompletion(currentAwards, true);
  }

  beginCompletionRefresh(reference: SessionReference): StudyAchievementRefresh | null {
    const session = this.state.activeSession;
    if (!session || session.id !== reference.id) return null;
    session.refreshRevision += 1;
    session.refreshCompleted = false;
    this.persist();
    return { sessionId: reference.id, revision: session.refreshRevision };
  }

  completeCurrentRefresh(
    refresh: StudyAchievementRefresh,
    awards: AchievementAward[]
  ): StudyAchievementSessionCompletion | null {
    const session = this.state.activeSession;
    if (!session || session.id !== refresh.sessionId) return null;
    if (session.refreshRevision !== refresh.revision) return null;
    session.refreshCompleted = true;
    prepareLateAwards(session, awards);
    return this.prepareCompletion(awards, false);
  }

  completeDeferredRefresh(refresh: StudyAchievementRefresh, awards: AchievementAward[]): void {
    this.deferred.settle(refresh, awards);
  }

  refreshDeferredBaseline(reference: SessionReference, awards: AchievementAward[]): void {
    this.deferred.refreshBaseline(reference.id, awards);
  }

  dismissCompletion(reference: SessionReference): void {
    const session = this.state.activeSession;
    if (!session || session.id !== reference.id) return;
    this.deferred.enqueue({
      id: session.id,
      revision: session.refreshRevision,
      baselineAwardIds: session.celebrationPresented
        ? [...session.baselineAwardIds, ...session.newAwardIds]
        : session.baselineAwardIds,
      newAwardIds: session.celebrationPresented ? [] : session.newAwardIds,
      needsRefresh: !session.refreshCompleted,
    });
    this.consumeCompletion(reference.id);
  }

  markCelebrationPresented(reference: SessionReference): void {
    const session = this.state.activeSession;
    if (!session || session.id !== reference.id) {
      this.refreshBaselineIds(this.deferred.markPresented(reference.id));
      return;
    }
    session.celebrationPresented = true;
    this.deferred.acknowledge(session.newAwardIds);
    session.baselineAwardIds = [...new Set([...session.baselineAwardIds, ...session.newAwardIds])];
    this.persist();
  }

  consumeCompletion(sessionId: string): void {
    if (this.state.activeSession?.id !== sessionId) return;
    this.state.activeSession = null;
    this.persist();
  }

  reopenCompletion(reference: SessionReference, currentAwards: AchievementAward[]): void {
    const session = this.state.activeSession;
    if (!session || session.id !== reference.id) return;
    if (!session.isReadyForPresentation) return;
    session.baselineAwardIds = currentAwards.map(({ id }) => id);
    session.newAwardIds = [];
    session.isReadyForPresentation = false;
    session.celebrationPresented = false;
    session.refreshRevision += 1;
    session.refreshCompleted = false;
    this.persist();
  }

  cancelCurrentSession(): void {
    if (this.state.activeSession?.isReadyForPresentation) {
      this.dismissCompletion(this.state.activeSession);
      return;
    }
    this.state.activeSession = null;
    this.persist();
  }

  private prepareCompletion(
    currentAwards: AchievementAward[],
    requireNewAward: boolean
  ): StudyAchievementSessionCompletion | null {
    const session = this.state.activeSession;
    if (!session || session.records.length === 0) return null;

    if (!session.isReadyForPresentation || !session.celebrationPresented) {
      session.newAwardIds = [
        ...new Set([...session.newAwardIds, ...detectAwardIds(session, currentAwards)]),
      ];
      if (requireNewAward && session.newAwardIds.length === 0) return null;
      session.isReadyForPresentation = true;
    }

    this.persist();
    return {
      id: session.id,
      records: [...session.records],
      newAwardIds: [...session.newAwardIds],
      celebrationPresented: session.celebrationPresented,
    };
  }

  private persist(): void {
    this.storage.setItem(
      studyAchievementSessionStorageKey(this.userId),
      JSON.stringify(this.state)
    );
  }
}
