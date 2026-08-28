import type { AchievementAward } from './achievementModel';
import type { StudySessionReviewRecord } from './studySessionWrapUpModel';

export interface StudyAchievementSessionCompletion {
  id: string;
  records: StudySessionReviewRecord[];
  newAwardIds: string[];
  celebrationPresented: boolean;
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
}

interface PersistedAchievementSessionState {
  activeSession: PersistedAchievementSession | null;
}

const emptyState = (): PersistedAchievementSessionState => ({ activeSession: null });

export const studyAchievementSessionStorageKey = (userId: string) =>
  `convo-lab.study-achievement-sessions-v1.${encodeURIComponent(userId)}`;

export const deleteStudyAchievementSessionData = (
  storage: StudyAchievementSessionStorage,
  userId: string
) => {
  storage.removeItem(studyAchievementSessionStorageKey(userId));
};

const stringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;

const loadState = (
  storage: StudyAchievementSessionStorage,
  userId: string
): PersistedAchievementSessionState => {
  const raw = storage.getItem(studyAchievementSessionStorageKey(userId));
  if (!raw) return emptyState();

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAchievementSessionState>;
    const session = parsed.activeSession;
    if (!session || typeof session !== 'object') return emptyState();
    const baselineAwardIds = stringArray(session.baselineAwardIds);
    const newAwardIds = stringArray(session.newAwardIds);
    if (
      typeof session.id !== 'string' ||
      !Array.isArray(session.records) ||
      baselineAwardIds === null ||
      newAwardIds === null
    ) {
      return emptyState();
    }
    return {
      activeSession: {
        id: session.id,
        records: session.records,
        baselineAwardIds,
        newAwardIds,
        isReadyForPresentation: session.isReadyForPresentation === true,
        celebrationPresented: session.celebrationPresented === true,
      },
    };
  } catch {
    return emptyState();
  }
};

interface StudyAchievementSessionStoreOptions {
  createId?: () => string;
}

export class StudyAchievementSessionStore {
  private state: PersistedAchievementSessionState;

  private readonly createId: () => string;

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
  }

  beginReviewSession(currentAwards: AchievementAward[]): void {
    if (this.state.activeSession?.isReadyForPresentation) return;
    this.state.activeSession = {
      id: this.createId(),
      records: [],
      baselineAwardIds: currentAwards.map(({ id }) => id),
      newAwardIds: [],
      isReadyForPresentation: false,
      celebrationPresented: false,
    };
    this.persist();
  }

  recordReview(record: StudySessionReviewRecord): void {
    const session = this.state.activeSession;
    if (!session || session.isReadyForPresentation) return;
    session.records = [...session.records.filter(({ id }) => id !== record.id), record];
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
    return this.prepareCompletion(currentAwards, true);
  }

  markCelebrationPresented(sessionId: string): void {
    const session = this.state.activeSession;
    if (!session || session.id !== sessionId) return;
    session.celebrationPresented = true;
    this.persist();
  }

  consumeCompletion(sessionId: string): void {
    if (this.state.activeSession?.id !== sessionId) return;
    this.state.activeSession = null;
    this.persist();
  }

  reopenCompletion(sessionId: string, currentAwards: AchievementAward[]): void {
    const session = this.state.activeSession;
    if (!session || session.id !== sessionId || !session.isReadyForPresentation) return;
    session.baselineAwardIds = currentAwards.map(({ id }) => id);
    session.newAwardIds = [];
    session.isReadyForPresentation = false;
    session.celebrationPresented = false;
    this.persist();
  }

  cancelCurrentSession(): void {
    if (this.state.activeSession?.isReadyForPresentation) return;
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
      const baseline = new Set(session.baselineAwardIds);
      const detectedAwardIds = currentAwards
        .filter(({ id }) => !baseline.has(id))
        .sort((left, right) => Date.parse(left.earnedAt) - Date.parse(right.earnedAt))
        .map(({ id }) => id);
      session.newAwardIds = [...new Set([...session.newAwardIds, ...detectedAwardIds])];
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
