export type StudyReviewRequestKind = 'review' | 'card-action' | 'undo';

export type StudyReviewRequestToken = symbol;

export interface StudyReviewRequestGuard {
  acquire: (kind: StudyReviewRequestKind, label?: string) => StudyReviewRequestToken | null;
  isBusy: () => boolean;
  release: (token: StudyReviewRequestToken) => boolean;
  reset: () => void;
}

export const createStudyReviewRequestGuard = (): StudyReviewRequestGuard => {
  let activeToken: StudyReviewRequestToken | null = null;

  return {
    acquire(kind, label) {
      if (activeToken) return null;

      const token = Symbol(label ?? kind);
      activeToken = token;
      return token;
    },
    isBusy() {
      return activeToken !== null;
    },
    release(token) {
      if (activeToken !== token) return false;

      activeToken = null;
      return true;
    },
    reset() {
      activeToken = null;
    },
  };
};
