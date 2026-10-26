import type { StudyBookSource } from '@languageflow/shared/src/types';
import { requestJson } from './apiClient';
import { studyApiPath } from './studyApi';

export function assignStudyCardSource(cardId: string, bookSource: StudyBookSource | null) {
  return requestJson(studyApiPath('/card-sources'), {
    method: 'PUT',
    body: JSON.stringify({ cardIds: [cardId], bookSource }),
  });
}
export function setStudyCardLearnSoon(cardId: string, learnSoon: boolean) {
  return requestJson(studyApiPath('/learn-soon'), {
    method: 'PUT',
    body: JSON.stringify({ cardIds: [cardId], learnSoon }),
  });
}

export function creationPlacementPayload(bookSource: StudyBookSource | null, learnSoon: boolean) {
  return { ...(bookSource ? { bookSource } : {}), ...(learnSoon ? { learnSoon } : {}) };
}
