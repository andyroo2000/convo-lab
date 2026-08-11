import type {
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyBrowserSortDirection,
  StudyBrowserSortField,
} from '@languageflow/shared/src/types';

import { requestJson } from './apiClient';
import { studyApiPath } from './studyApi';

export interface StudyBrowserQuery {
  q?: string;
  noteType?: string;
  cardType?: 'recognition' | 'production' | 'cloze';
  queueState?: 'new' | 'learning' | 'review' | 'relearning' | 'suspended' | 'buried';
  sortField?: StudyBrowserSortField;
  sortDirection?: StudyBrowserSortDirection;
  cursor?: string;
  limit?: number;
}

type StudyBrowseRequestInit = Pick<RequestInit, 'signal'>;

export async function getStudyBrowser(
  query: StudyBrowserQuery = {},
  init?: StudyBrowseRequestInit
): Promise<StudyBrowserListResponse> {
  const searchParams = new URLSearchParams();
  if (query.q) searchParams.set('q', query.q);
  if (query.noteType) searchParams.set('noteType', query.noteType);
  if (query.cardType) searchParams.set('cardType', query.cardType);
  if (query.queueState) searchParams.set('queueState', query.queueState);
  if (query.sortField) searchParams.set('sortField', query.sortField);
  if (query.sortDirection) searchParams.set('sortDirection', query.sortDirection);
  if (query.cursor) searchParams.set('cursor', query.cursor);
  if (typeof query.limit === 'number') searchParams.set('limit', String(query.limit));

  const suffix = searchParams.toString();
  return requestJson<StudyBrowserListResponse>(
    studyApiPath(`/browser${suffix ? `?${suffix}` : ''}`),
    init
  );
}

export async function getStudyBrowserNoteDetail(
  noteId: string,
  init?: StudyBrowseRequestInit
): Promise<StudyBrowserNoteDetail> {
  return requestJson<StudyBrowserNoteDetail>(
    studyApiPath(`/browser/${encodeURIComponent(noteId)}`),
    init
  );
}
