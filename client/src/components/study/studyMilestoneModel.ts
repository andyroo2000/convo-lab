import type { StudySessionReviewRecord } from './studySessionWrapUpModel';

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
  presentedAt?: string | null;
}

export interface StudyMilestoneSnapshot {
  milestones: StudyMilestoneAward[];
  pendingMilestones: StudyMilestoneAward[];
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
  records: StudySessionReviewRecord[];
  newAwardIds: StudyMilestoneId[];
  isReadyForPresentation: boolean;
  celebrationPresented: boolean;
}

interface PersistedMilestoneState {
  earnedAwards: StudyMilestoneAward[];
  activeSession: PersistedReviewSession | null;
}

const emptyState = (): PersistedMilestoneState => ({
  earnedAwards: [],
  activeSession: null,
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
            typeof (award as StudyMilestoneAward).earnedAt === 'string' &&
            (typeof (award as StudyMilestoneAward).presentedAt === 'string' ||
              (award as StudyMilestoneAward).presentedAt === null ||
              typeof (award as StudyMilestoneAward).presentedAt === 'undefined')
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
            newAwardIds: activeSession.newAwardIds.filter(isMilestoneId),
            isReadyForPresentation: activeSession.isReadyForPresentation === true,
            celebrationPresented: activeSession.celebrationPresented === true,
          }
        : null;

    return {
      earnedAwards,
      activeSession: validSession,
    };
  } catch {
    return emptyState();
  }
};

interface StudyMilestoneStoreOptions {
  createId?: () => string;
}

export class StudyMilestoneStore {
  private state: PersistedMilestoneState;

  private readonly createId: () => string;

  constructor(
    private readonly storage: StudyMilestoneStorage,
    private readonly userId: string,
    options: StudyMilestoneStoreOptions = {}
  ) {
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

  beginReviewSession(): void {
    if (this.state.activeSession?.isReadyForPresentation) {
      this.persist();
      return;
    }

    this.state.activeSession = {
      id: this.createId(),
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

  applyServerSnapshot(snapshot: StudyMilestoneSnapshot): void {
    this.state.earnedAwards = [...snapshot.milestones];
    this.persist();
  }

  prepareCurrentSessionCompletion(
    newAwards: StudyMilestoneAward[] = []
  ): StudyMilestoneCompletion | null {
    return this.prepareCompletion(newAwards, false);
  }

  prepareInterruptedCompletion(
    newAwards: StudyMilestoneAward[] = []
  ): StudyMilestoneCompletion | null {
    return this.prepareCompletion(newAwards, true);
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

    if (!session.celebrationPresented) {
      const unpresentedAwardIds = new Set(session.newAwardIds);
      this.state.earnedAwards = this.state.earnedAwards.filter(
        ({ id }) => !unpresentedAwardIds.has(id)
      );
    }
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
    newAwards: StudyMilestoneAward[],
    requireNewAward: boolean
  ): StudyMilestoneCompletion | null {
    const session = this.state.activeSession;
    if (!session || session.records.length === 0) return null;

    if (!session.isReadyForPresentation) {
      if (requireNewAward && newAwards.length === 0) return null;
      session.isReadyForPresentation = true;
      session.newAwardIds = newAwards.map(({ id }) => id);
    } else if (session.newAwardIds.length === 0 && newAwards.length > 0) {
      // A wrap-up prepared offline can pick up an award once review state reaches
      // the server. Once this session commits to a celebration, do not erase it.
      session.newAwardIds = newAwards.map(({ id }) => id);
    }

    this.mergeAwards(newAwards);
    this.persist();

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

  private mergeAwards(awards: StudyMilestoneAward[]): void {
    const awardsById = new Map(this.state.earnedAwards.map((award) => [award.id, award]));
    awards.forEach((award) => awardsById.set(award.id, award));
    this.state.earnedAwards = [...awardsById.values()];
  }

  private persist(): void {
    this.storage.setItem(studyMilestoneStorageKey(this.userId), JSON.stringify(this.state));
  }
}
