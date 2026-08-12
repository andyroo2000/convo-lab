import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

class StudyDraftRevisionConflictError extends Error {
  constructor(
    message: string,
    public readonly draft: StudyManualCardDraft
  ) {
    super(message);
    this.name = 'StudyDraftRevisionConflictError';
  }
}

export default StudyDraftRevisionConflictError;
