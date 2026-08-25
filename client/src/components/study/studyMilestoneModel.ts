import type { StudySessionReviewRecord } from './studySessionWrapUpModel';
import { buildStudySessionWrapUp } from './studySessionWrapUpModel';

export type StudyMilestoneId = 'burned100' | 'burned500' | 'burned1000';

export interface StudyMilestoneDefinition {
  id: StudyMilestoneId;
  threshold: number;
  badgeText: string;
  titleKey: string;
  detailKey: string;
}

export interface StudyMilestoneAward {
  id: StudyMilestoneId;
  earnedAt: string;
}

export interface StudyMilestoneCompletion {
  id: string;
  records: StudySessionReviewRecord[];
  newAwards: StudyMilestoneAward[];
  celebrationPresented: boolean;
}

export interface StudyMilestoneStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface PersistedReviewSession {
  id: string;
  initialBurnedCount: number;
  records: StudySessionReviewRecord[];
  newAwardIds: StudyMilestoneId[];
  isReadyForPresentation: boolean;
  celebrationPresented: boolean;
}

interface PersistedMilestoneState {
  earnedAwards: StudyMilestoneAward[];
  activeSession: PersistedReviewSession | null;
  hasSeededBurnedMilestones: boolean;
}

const emptyState = (): PersistedMilestoneState => ({
  earnedAwards: [],
  activeSession: null,
  hasSeededBurnedMilestones: false,
});

export const STUDY_MILESTONE_DEFINITIONS: StudyMilestoneDefinition[] = [
  {
    id: 'burned100',
    threshold: 100,
    badgeText: '100',
    titleKey: 'milestones.burned100.title',
    detailKey: 'milestones.burned100.detail',
  },
  {
    id: 'burned500',
    threshold: 500,
    badgeText: '500',
    titleKey: 'milestones.burned500.title',
    detailKey: 'milestones.burned500.detail',
  },
  {
    id: 'burned1000',
    threshold: 1_000,
    badgeText: '1K',
    titleKey: 'milestones.burned1000.title',
    detailKey: 'milestones.burned1000.detail',
  },
];

const milestoneById = new Map(
  STUDY_MILESTONE_DEFINITIONS.map((definition) => [definition.id, definition])
);

export const getStudyMilestoneDefinition = (id: StudyMilestoneId) => {
  const definition = milestoneById.get(id);
  if (!definition) throw new Error(`Unknown study milestone: ${id}`);
  return definition;
};

export const studyMilestoneStorageKey = (userId: string) =>
  `convo-lab.study-milestones-v1.${encodeURIComponent(userId)}`;

export const deleteStudyMilestoneData = (storage: StudyMilestoneStorage, userId: string) => {
  storage.removeItem(studyMilestoneStorageKey(userId));
};

const isMilestoneId = (value: unknown): value is StudyMilestoneId =>
  typeof value === 'string' && milestoneById.has(value as StudyMilestoneId);

const loadState = (storage: StudyMilestoneStorage, userId: string): PersistedMilestoneState => {
  const raw = storage.getItem(studyMilestoneStorageKey(userId));
  if (!raw) return emptyState();

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedMilestoneState>;
    const earnedAwards = Array.isArray(parsed.earnedAwards)
      ? parsed.earnedAwards.filter(
          (award): award is StudyMilestoneAward =>
            typeof award === 'object' &&
            award !== null &&
            isMilestoneId((award as StudyMilestoneAward).id) &&
            typeof (award as StudyMilestoneAward).earnedAt === 'string'
        )
      : [];
    const { activeSession } = parsed;
    const validSession =
      activeSession &&
      typeof activeSession.id === 'string' &&
      Array.isArray(activeSession.records) &&
      Array.isArray(activeSession.newAwardIds)
        ? {
            ...activeSession,
            initialBurnedCount: Math.max(0, Number(activeSession.initialBurnedCount) || 0),
            newAwardIds: activeSession.newAwardIds.filter(isMilestoneId),
            isReadyForPresentation: activeSession.isReadyForPresentation === true,
            celebrationPresented: activeSession.celebrationPresented === true,
          }
        : null;

    return {
      earnedAwards,
      activeSession: validSession,
      hasSeededBurnedMilestones: parsed.hasSeededBurnedMilestones === true,
    };
  } catch {
    return emptyState();
  }
};

interface StudyMilestoneStoreOptions {
  now?: () => Date;
  createId?: () => string;
}

export class StudyMilestoneStore {
  private state: PersistedMilestoneState;

  private readonly now: () => Date;

  private readonly createId: () => string;

  constructor(
    private readonly storage: StudyMilestoneStorage,
    private readonly userId: string,
    options: StudyMilestoneStoreOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    this.state = loadState(storage, userId);
  }

  get earnedAwards(): StudyMilestoneAward[] {
    return [...this.state.earnedAwards].sort((left, right) => {
      const dateOrder = right.earnedAt.localeCompare(left.earnedAt);
      if (dateOrder !== 0) return dateOrder;
      return (
        getStudyMilestoneDefinition(right.id).threshold -
        getStudyMilestoneDefinition(left.id).threshold
      );
    });
  }

  get upcomingMilestones(): StudyMilestoneDefinition[] {
    const earnedIds = new Set(this.state.earnedAwards.map(({ id }) => id));
    return STUDY_MILESTONE_DEFINITIONS.filter(({ id }) => !earnedIds.has(id));
  }

  beginReviewSession(burnedCount?: number): void {
    const hasBurnedCount = typeof burnedCount === 'number' && Number.isFinite(burnedCount);
    const normalizedCount = hasBurnedCount ? Math.max(0, burnedCount) : 0;
    if (hasBurnedCount) this.seedExistingMilestones(normalizedCount);

    if (this.state.activeSession?.isReadyForPresentation) {
      this.persist();
      return;
    }

    this.state.activeSession = {
      id: this.createId(),
      initialBurnedCount: normalizedCount,
      records: [],
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

  prepareCurrentSessionCompletion(): StudyMilestoneCompletion | null {
    return this.prepareCompletion(false);
  }

  prepareInterruptedCompletion(): StudyMilestoneCompletion | null {
    return this.prepareCompletion(true);
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

  reopenCompletion(sessionId: string): void {
    const session = this.state.activeSession;
    if (!session || session.id !== sessionId || !session.isReadyForPresentation) return;

    const awardedIds = new Set(session.newAwardIds);
    this.state.earnedAwards = this.state.earnedAwards.filter(({ id }) => !awardedIds.has(id));
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

  private prepareCompletion(requireNewAward: boolean): StudyMilestoneCompletion | null {
    const session = this.state.activeSession;
    if (!session || session.records.length === 0) return null;

    if (!session.isReadyForPresentation) {
      const newAwardIds = this.newMilestoneIds(session);
      if (requireNewAward && newAwardIds.length === 0) return null;

      const earnedAt = this.now().toISOString();
      this.state.earnedAwards.push(
        ...newAwardIds.map((id): StudyMilestoneAward => ({ id, earnedAt }))
      );
      session.newAwardIds = newAwardIds;
      session.isReadyForPresentation = true;
      this.persist();
    }

    return this.completion(session);
  }

  private completion(session: PersistedReviewSession): StudyMilestoneCompletion {
    const awardsById = new Map(this.state.earnedAwards.map((award) => [award.id, award]));
    return {
      id: session.id,
      records: [...session.records],
      newAwards: session.newAwardIds.flatMap((id) => {
        const award = awardsById.get(id);
        return award ? [award] : [];
      }),
      celebrationPresented: session.celebrationPresented,
    };
  }

  private newMilestoneIds(session: PersistedReviewSession): StudyMilestoneId[] {
    const summary = buildStudySessionWrapUp(session.records);
    const burnedCount = Math.max(0, session.initialBurnedCount + summary.burnedCountChange);
    const earnedIds = new Set(this.state.earnedAwards.map(({ id }) => id));
    return STUDY_MILESTONE_DEFINITIONS.filter(
      ({ id, threshold }) => !earnedIds.has(id) && burnedCount >= threshold
    ).map(({ id }) => id);
  }

  private seedExistingMilestones(burnedCount: number): void {
    if (this.state.hasSeededBurnedMilestones) return;
    const earnedIds = new Set(this.state.earnedAwards.map(({ id }) => id));
    const earnedAt = this.now().toISOString();
    this.state.earnedAwards.push(
      ...STUDY_MILESTONE_DEFINITIONS.filter(
        ({ id, threshold }) => !earnedIds.has(id) && burnedCount >= threshold
      ).map(({ id }): StudyMilestoneAward => ({ id, earnedAt }))
    );
    this.state.hasSeededBurnedMilestones = true;
  }

  private persist(): void {
    this.storage.setItem(studyMilestoneStorageKey(this.userId), JSON.stringify(this.state));
  }
}
