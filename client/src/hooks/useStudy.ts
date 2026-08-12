import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ulid } from 'ulid';
import type {
  StudyAnswerPayload,
  StudyCardActionName,
  StudyCardActionRequest,
  StudyCardActionResult,
  StudyCardSetDueMode,
  StudyCardCreationKind,
  StudyCardDraftImageResponse,
  StudyCardDraftPreviewAudioResponse,
  StudyManualCardDraft,
  StudyManualCardDraftCreateCardResponse,
  StudyManualCardDraftCreateRequest,
  StudyManualCardDraftListResponse,
  StudyManualCardDraftUpdateRequest,
  StudyCardRegenerateImageRequest,
  StudyCardSummary,
  StudyCardListResponse,
  StudyImportResult,
  StudyImportUploadReadiness,
  StudyImportUploadSession,
  StudyNewCardQueueResponse,
  StudyOverview,
  StudyPromptPayload,
  StudyReviewResult,
  StudySettings,
  StudyUndoReviewResult,
  StudyVocabBundleDraftCreateResponse,
  StudyVocabBundleGenerateRequest,
} from '@languageflow/shared/src/types';

import { CSRF_TOKEN_HEADER_NAME, getCsrfToken } from '../lib/csrf';
import { JsonRequestError, requestJson } from '../lib/apiClient';
import StudyDraftRevisionConflictError from '../lib/studyDraftRevisionConflict';
import { studyApiPath } from '../lib/studyApi';
import {
  getStudyBrowser,
  getStudyBrowserNoteDetail,
  type StudyBrowserQuery,
} from '../lib/studyBrowseApi';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';

export { getStudyBrowser, getStudyBrowserNoteDetail };
export type { StudyBrowserQuery };

export interface StudySessionResponse {
  overview: StudyOverview;
  cards: StudyCardSummary[];
}

export interface CreateStudyCardPayload {
  id: string;
  creationKind?: StudyCardCreationKind;
  cardType: 'recognition' | 'production' | 'cloze';
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface UpdateStudyCardPayload {
  cardId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface RegenerateStudyAnswerAudioPayload {
  cardId: string;
  answerAudioVoiceId?: string | null;
  answerAudioTextOverride?: string | null;
}

interface RegenerateStudyCardImagePayload extends StudyCardRegenerateImageRequest {
  cardId: string;
}

interface StudyCardActionPayload {
  cardId: string;
  action: StudyCardActionName;
  mode?: StudyCardSetDueMode;
  dueAt?: string;
  timeZone?: string;
  currentOverview?: StudyOverview;
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapLearningOsData(value: unknown): unknown {
  return isJsonRecord(value) && Object.prototype.hasOwnProperty.call(value, 'data')
    ? value.data
    : value;
}

function stringValue(record: JsonRecord, camelKey: string, snakeKey: string): string {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'string' ? value : '';
}

function nullableStringValue(
  record: JsonRecord,
  camelKey: string,
  snakeKey: string
): string | null {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'string' ? value : null;
}

function numberValue(record: JsonRecord, camelKey: string, snakeKey: string): number {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeStudyImportPreview(value: unknown): StudyImportResult['preview'] {
  const preview = isJsonRecord(value) ? value : {};
  const breakdownValue = preview.noteTypeBreakdown ?? preview.note_type_breakdown;
  const warningsValue = preview.warnings;

  return {
    deckName: stringValue(preview, 'deckName', 'deck_name'),
    cardCount: numberValue(preview, 'cardCount', 'card_count'),
    noteCount: numberValue(preview, 'noteCount', 'note_count'),
    reviewLogCount: numberValue(preview, 'reviewLogCount', 'review_log_count'),
    mediaReferenceCount: numberValue(preview, 'mediaReferenceCount', 'media_reference_count'),
    skippedMediaCount: numberValue(preview, 'skippedMediaCount', 'skipped_media_count'),
    warnings: Array.isArray(warningsValue)
      ? warningsValue.filter((warning): warning is string => typeof warning === 'string')
      : [],
    noteTypeBreakdown: Array.isArray(breakdownValue)
      ? breakdownValue.filter(isJsonRecord).map((item) => ({
          notetypeName: stringValue(item, 'notetypeName', 'notetype_name'),
          noteCount: numberValue(item, 'noteCount', 'note_count'),
          cardCount: numberValue(item, 'cardCount', 'card_count'),
        }))
      : [],
  };
}

function normalizeStudyImportResult(value: unknown): StudyImportResult {
  const result = unwrapLearningOsData(value);
  if (!isJsonRecord(result)) {
    throw new Error('Study import response was malformed.');
  }

  const { status } = result;
  if (
    status !== 'pending' &&
    status !== 'processing' &&
    status !== 'completed' &&
    status !== 'failed'
  ) {
    throw new Error('Study import response contained an invalid status.');
  }

  const sourceSizeValue = result.sourceSizeBytes ?? result.source_size_bytes;
  const id = stringValue(result, 'id', 'id');
  if (!id) {
    throw new Error('Study import response did not include an id.');
  }

  return {
    id,
    status,
    sourceFilename: stringValue(result, 'sourceFilename', 'source_filename'),
    deckName: stringValue(result, 'deckName', 'deck_name'),
    preview: normalizeStudyImportPreview(result.preview),
    uploadedAt: nullableStringValue(result, 'uploadedAt', 'uploaded_at'),
    uploadExpiresAt: nullableStringValue(result, 'uploadExpiresAt', 'upload_expires_at'),
    sourceSizeBytes:
      typeof sourceSizeValue === 'number' && Number.isFinite(sourceSizeValue)
        ? sourceSizeValue
        : null,
    importedAt: nullableStringValue(result, 'importedAt', 'completed_at'),
    errorMessage: nullableStringValue(result, 'errorMessage', 'error_message'),
  };
}

async function apiRequest<T>(
  endpoint: string,
  init?: RequestInit,
  acceptedEmptyStatuses: readonly number[] = []
): Promise<T> {
  return requestJson<T>(studyApiPath(endpoint), init, {
    acceptedEmptyStatuses,
  });
}

function isStudyDraftRevisionConflictPayload(error: unknown): error is JsonRequestError & {
  payload: { code: 'draft_revision_conflict'; message: string; draft: StudyManualCardDraft };
} {
  if (!(error instanceof JsonRequestError) || error.status !== 409) return false;
  const { payload } = error;
  if (typeof payload !== 'object' || payload === null) return false;
  if (!('code' in payload) || payload.code !== 'draft_revision_conflict') return false;
  if (!('message' in payload) || typeof payload.message !== 'string') return false;
  if (!('draft' in payload) || typeof payload.draft !== 'object' || payload.draft === null) {
    return false;
  }
  return (
    'id' in payload.draft &&
    typeof payload.draft.id === 'string' &&
    'revision' in payload.draft &&
    typeof payload.draft.revision === 'number'
  );
}

export async function startStudySession(): Promise<StudySessionResponse> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudySessionResponse>('/session/start', {
    method: 'POST',
    body: JSON.stringify({ timeZone }),
  });
}

export async function startStudyLesson(): Promise<StudySessionResponse> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudySessionResponse>('/lessons/start', {
    method: 'POST',
    body: JSON.stringify({ timeZone }),
  });
}

export async function getStudySettings(): Promise<StudySettings> {
  return apiRequest<StudySettings>('/settings');
}

export async function updateStudySettings(payload: StudySettings): Promise<StudySettings> {
  return apiRequest<StudySettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getStudyNewCardQueue(
  params: {
    cursor?: string | null;
    limit?: number;
    q?: string;
  } = {}
): Promise<StudyNewCardQueueResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));
  if (params.q?.trim()) searchParams.set('q', params.q.trim());

  const suffix = searchParams.toString();
  return apiRequest<StudyNewCardQueueResponse>(`/new-queue${suffix ? `?${suffix}` : ''}`);
}

export async function getStudyCards(
  params: { cursor?: string | null; limit?: number; q?: string } = {}
): Promise<StudyCardListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  // This endpoint reuses Learning OS's canonical ListCardsRequest contract.
  if (typeof params.limit === 'number') searchParams.set('per_page', String(params.limit));
  if (params.q?.trim()) searchParams.set('q', params.q.trim());

  const suffix = searchParams.toString();
  return apiRequest<StudyCardListResponse>(`/cards${suffix ? `?${suffix}` : ''}`);
}

export async function reorderStudyNewCardQueue(cardIds: string[]) {
  return apiRequest<StudyNewCardQueueResponse>('/new-queue/reorder', {
    method: 'POST',
    body: JSON.stringify({ cardIds }),
  });
}

const MAX_REORDER_CARD_IDS = 500;

async function reorderStudyNewCardQueuePrefix(
  cardId: string,
  precedingCardIds: string[]
): Promise<StudyNewCardQueueResponse> {
  const precedingChunk = precedingCardIds.slice(-(MAX_REORDER_CARD_IDS - 1));
  const remainingPrecedingCardIds = precedingCardIds.slice(
    0,
    precedingCardIds.length - precedingChunk.length
  );
  const result = await reorderStudyNewCardQueue([cardId, ...precedingChunk]);

  if (remainingPrecedingCardIds.length === 0) return result;
  return reorderStudyNewCardQueuePrefix(cardId, remainingPrecedingCardIds);
}

async function getStudyNewCardQueuePrefix(
  cardId: string,
  cursor: string | null = null,
  precedingCardIds: string[] = [],
  firstPage: StudyNewCardQueueResponse | null = null
): Promise<{ firstPage: StudyNewCardQueueResponse; precedingCardIds: string[] }> {
  const page = await getStudyNewCardQueue({ cursor, limit: 100 });
  const initialPage = firstPage ?? page;
  const selectedIndex = page.items.findIndex((item) => item.id === cardId);

  if (selectedIndex >= 0) {
    return {
      firstPage: initialPage,
      precedingCardIds: [
        ...precedingCardIds,
        ...page.items.slice(0, selectedIndex).map((item) => item.id),
      ],
    };
  }

  if (page.nextCursor) {
    return getStudyNewCardQueuePrefix(
      cardId,
      page.nextCursor,
      [...precedingCardIds, ...page.items.map((item) => item.id)],
      initialPage
    );
  }

  if (initialPage.items.length === 0) {
    throw new Error('No active new-card queue is available.');
  }

  throw new Error('The selected card is not in the active new-card queue.');
}

export async function promoteStudyNewCardToFront(cardId: string) {
  const { firstPage, precedingCardIds } = await getStudyNewCardQueuePrefix(cardId);
  if (precedingCardIds.length === 0) return firstPage;

  // The reorder API assigns the supplied cards to their existing queue
  // positions in the requested order. Including every card ahead of the
  // selected card shifts that prefix down instead of swapping position 1.
  // Large prefixes are shifted from the selected card backward in bounded
  // chunks because the backend accepts at most 500 card IDs per request.
  return reorderStudyNewCardQueuePrefix(cardId, precedingCardIds);
}

export async function prepareStudyAnswerAudio(cardId: string): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(`/cards/${encodeURIComponent(cardId)}/prepare-answer-audio`, {
    method: 'POST',
  });
}

export async function regenerateStudyAnswerAudio(
  payload: RegenerateStudyAnswerAudioPayload
): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(
    `/cards/${encodeURIComponent(payload.cardId)}/regenerate-answer-audio`,
    {
      method: 'POST',
      body: JSON.stringify({
        answerAudioVoiceId: payload.answerAudioVoiceId,
        answerAudioTextOverride: payload.answerAudioTextOverride,
      }),
    }
  );
}

export async function regenerateStudyCardImage(
  payload: RegenerateStudyCardImagePayload
): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(
    `/cards/${encodeURIComponent(payload.cardId)}/regenerate-image`,
    {
      method: 'POST',
      body: JSON.stringify({
        imagePrompt: payload.imagePrompt,
        imageRole: payload.imageRole,
      }),
    }
  );
}

export async function resolveStudyCardPitchAccent(cardId: string): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(`/cards/${encodeURIComponent(cardId)}/pitch-accent`, {
    method: 'POST',
  });
}

export async function createStudyVocabBundleDrafts(
  payload: StudyVocabBundleGenerateRequest
): Promise<StudyVocabBundleDraftCreateResponse> {
  return apiRequest<StudyVocabBundleDraftCreateResponse>('/card-candidates/vocab-bundle/drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateStudyManualCardDraftPreviewAudio(
  draftId: string
): Promise<StudyCardDraftPreviewAudioResponse> {
  return apiRequest<StudyCardDraftPreviewAudioResponse>(
    `/card-drafts/${encodeURIComponent(draftId)}/preview-audio`,
    { method: 'POST' }
  );
}

export async function generateStudyManualCardDraftPreviewImage(
  draftId: string
): Promise<StudyCardDraftImageResponse> {
  return apiRequest<StudyCardDraftImageResponse>(
    `/card-drafts/${encodeURIComponent(draftId)}/preview-image`,
    { method: 'POST' }
  );
}

export function createStudyCardId(): string {
  return ulid();
}

export async function getStudyManualCardDrafts(
  params: { cursor?: string | null; limit?: number } = {}
): Promise<StudyManualCardDraftListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));
  const suffix = searchParams.toString();
  return apiRequest<StudyManualCardDraftListResponse>(`/card-drafts${suffix ? `?${suffix}` : ''}`);
}

export async function createStudyManualCardDraft(
  payload: StudyManualCardDraftCreateRequest
): Promise<StudyManualCardDraft> {
  return apiRequest<StudyManualCardDraft>('/card-drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateStudyManualCardDraft(payload: {
  draftId: string;
  values: StudyManualCardDraftUpdateRequest;
}): Promise<StudyManualCardDraft> {
  try {
    return await apiRequest<StudyManualCardDraft>(`/card-drafts/${payload.draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload.values),
    });
  } catch (error) {
    if (isStudyDraftRevisionConflictPayload(error)) {
      throw new StudyDraftRevisionConflictError(error.payload.message, error.payload.draft);
    }
    throw error;
  }
}

export async function retryStudyManualCardDraft(draftId: string): Promise<StudyManualCardDraft> {
  return apiRequest<StudyManualCardDraft>(`/card-drafts/${draftId}/retry`, {
    method: 'POST',
  });
}

export async function createCardFromStudyManualCardDraft(
  draftId: string,
  cardId = createStudyCardId()
): Promise<StudyManualCardDraftCreateCardResponse> {
  const card = await apiRequest<StudyCardSummary>(`/card-drafts/${draftId}/create-card`, {
    method: 'POST',
    body: JSON.stringify({ id: cardId }),
  });
  return { draftId, card };
}

export async function deleteStudyManualCardDraft(draftId: string): Promise<void> {
  await apiRequest<unknown>(
    `/card-drafts/${draftId}`,
    {
      method: 'DELETE',
    },
    [404]
  );
}

export async function undoStudyReview(
  reviewLogId: string,
  currentOverview?: StudyOverview
): Promise<StudyUndoReviewResult> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudyUndoReviewResult>('/reviews/undo', {
    method: 'POST',
    body: JSON.stringify({ reviewLogId, currentOverview, timeZone }),
  });
}

export async function submitStudyReview(
  payload: {
    cardId: string;
    grade: 'again' | 'hard' | 'good' | 'easy';
    durationMs?: number;
  },
  currentOverview?: StudyOverview
): Promise<StudyReviewResult> {
  return apiRequest<StudyReviewResult>('/reviews', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      timeZone: getDeviceStudyTimeZone(),
      currentOverview,
    }),
  });
}

export async function createStudyCard(payload: CreateStudyCardPayload): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>('/cards', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateStudyCard(payload: UpdateStudyCardPayload): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(`/cards/${encodeURIComponent(payload.cardId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      prompt: payload.prompt,
      answer: payload.answer,
    }),
  });
}

export async function deleteStudyCard(cardId: string): Promise<void> {
  await apiRequest<unknown>(`/cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
  });
}

export async function performStudyCardAction(
  payload: StudyCardActionPayload
): Promise<StudyCardActionResult> {
  const request: StudyCardActionRequest = {
    action: payload.action,
    mode: payload.mode,
    dueAt: payload.dueAt,
    timeZone: payload.timeZone,
    currentOverview: payload.currentOverview,
  };

  return apiRequest<StudyCardActionResult>(`/cards/${encodeURIComponent(payload.cardId)}/actions`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function useStudyOverview(enabled: boolean) {
  const timeZone = getDeviceStudyTimeZone();
  const searchParams = new URLSearchParams();
  if (timeZone) searchParams.set('timeZone', timeZone);

  return useQuery({
    queryKey: ['study', 'overview'],
    queryFn: () =>
      apiRequest<StudyOverview>(
        `/overview${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      ),
    enabled,
    // The app-wide QueryClient disables focus refetches; study counts should refresh
    // when returning to the dashboard now that the manual refresh control is gone.
    refetchOnWindowFocus: true,
  });
}

export function useStudySettings(enabled: boolean) {
  return useQuery({
    queryKey: ['study', 'settings'],
    queryFn: getStudySettings,
    enabled,
  });
}

export function useStudyNewCardQueueInfinite(enabled: boolean, q = '') {
  return useInfiniteQuery({
    queryKey: ['study', 'new-queue', 'infinite', q],
    queryFn: ({ pageParam }) => getStudyNewCardQueue({ cursor: pageParam, limit: 50, q }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useStudyCardsInfinite(enabled: boolean, q = '') {
  return useInfiniteQuery({
    queryKey: ['study', 'cards', 'infinite', q],
    queryFn: ({ pageParam }) => getStudyCards({ cursor: pageParam, limit: 50, q }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useUpdateStudySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStudySettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'settings'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
      ]);
    },
  });
}

export function useReorderStudyNewCardQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderStudyNewCardQueue,
    onSuccess: async () => {
      // Reordering changes the position-based pagination cursor. Refetch every
      // loaded page so both the canonical order and next cursor stay coherent.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'new-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
      ]);
    },
  });
}

export function usePromoteStudyNewCardToFront() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: promoteStudyNewCardToFront,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'new-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
      ]);
    },
  });
}

export function useStudyBrowser(enabled: boolean, query: StudyBrowserQuery) {
  return useQuery({
    queryKey: ['study', 'browser', query],
    queryFn: ({ signal }) => getStudyBrowser(query, { signal }),
    enabled,
  });
}

export function useStudyBrowserNoteDetail(enabled: boolean, noteId?: string) {
  return useQuery({
    queryKey: ['study', 'browser', 'note', noteId ?? 'none'],
    queryFn: ({ signal }) => getStudyBrowserNoteDetail(noteId as string, { signal }),
    enabled: enabled && Boolean(noteId),
  });
}

export function useSubmitStudyReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      cardId: string;
      grade: 'again' | 'hard' | 'good' | 'easy';
      durationMs?: number;
    }) =>
      submitStudyReview(payload, queryClient.getQueryData<StudyOverview>(['study', 'overview'])),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
      ]);
    },
  });
}

export function useCreateStudyCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStudyCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
      ]);
    },
  });
}

export function useCreateStudyVocabBundleDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStudyVocabBundleDrafts,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useGenerateStudyManualCardDraftPreviewAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateStudyManualCardDraftPreviewAudio,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useGenerateStudyManualCardDraftPreviewImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateStudyManualCardDraftPreviewImage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useStudyManualCardDrafts(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['study', 'manual-card-drafts'],
    queryFn: ({ pageParam }) => getStudyManualCardDrafts({ cursor: pageParam, limit: 200 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.drafts.some((draft) => draft.status === 'generating')
      )
        ? 2500
        : false,
  });
}

export function useCreateStudyManualCardDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStudyManualCardDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useUpdateStudyManualCardDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStudyManualCardDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useRetryStudyManualCardDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryStudyManualCardDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useCreateCardFromStudyManualCardDraft() {
  const queryClient = useQueryClient();
  const pendingCardIds = useRef(new Map<string, string>());

  return useMutation({
    mutationFn: async (draft: Pick<StudyManualCardDraft, 'id' | 'committedCardId'>) => {
      const draftId = draft.id;
      const cardId =
        pendingCardIds.current.get(draftId) ?? draft.committedCardId ?? createStudyCardId();
      pendingCardIds.current.set(draftId, cardId);
      const result = await createCardFromStudyManualCardDraft(draftId, cardId);
      await deleteStudyManualCardDraft(draftId);
      return result;
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
      ]);
    },
    onSuccess: async (_result, draft) => {
      pendingCardIds.current.delete(draft.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
      ]);
    },
  });
}

export function useDeleteStudyManualCardDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStudyManualCardDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['study', 'manual-card-drafts'] });
    },
  });
}

export function useUpdateStudyCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStudyCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'export'] }),
      ]);
    },
  });
}

export function useDeleteStudyCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStudyCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'export'] }),
      ]);
    },
  });
}

export function useRegenerateStudyAnswerAudio() {
  return useMutation({
    mutationFn: regenerateStudyAnswerAudio,
  });
}

export function useRegenerateStudyCardImage() {
  return useMutation({
    mutationFn: regenerateStudyCardImage,
  });
}

export function useStudyCardAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StudyCardActionPayload) =>
      performStudyCardAction({
        ...payload,
        currentOverview: queryClient.getQueryData<StudyOverview>(['study', 'overview']),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'export'] }),
      ]);
    },
  });
}

export async function createStudyImportUploadSession(
  file: File
): Promise<StudyImportUploadSession> {
  const response = await apiRequest<unknown>('/imports', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
    }),
  });
  const session = unwrapLearningOsData(response);
  if (!isJsonRecord(session)) {
    throw new Error('Study import upload session was malformed.');
  }
  const importJob = session.importJob ?? session.import_job;
  const { upload } = session;
  if (!isJsonRecord(upload) || upload.method !== 'PUT' || typeof upload.url !== 'string') {
    throw new Error('Study import upload session was malformed.');
  }

  return {
    importJob: normalizeStudyImportResult(importJob),
    upload: {
      method: 'PUT',
      url: upload.url,
      headers: isJsonRecord(upload.headers)
        ? Object.fromEntries(
            Object.entries(upload.headers).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
          )
        : {},
    },
  };
}

export async function uploadStudyImportArchive(
  session: StudyImportUploadSession,
  file: File,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    throw new Error('Unable to initialize secure upload.');
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abortHandler = () => {
      request.abort();
    };

    if (options.signal?.aborted) {
      reject(new Error('Upload cancelled'));
      return;
    }

    request.open(session.upload.method, session.upload.url);

    Object.entries(session.upload.headers).forEach(([headerName, headerValue]) => {
      request.setRequestHeader(headerName, headerValue);
    });
    request.setRequestHeader(CSRF_TOKEN_HEADER_NAME, csrfToken);

    options.signal?.addEventListener('abort', abortHandler, { once: true });

    const cleanup = () => {
      options.signal?.removeEventListener('abort', abortHandler);
    };

    request.upload.onprogress = (event) => {
      if (typeof options.onProgress === 'function' && event.lengthComputable && event.total > 0) {
        options.onProgress(Math.min(1, event.loaded / event.total));
      }
    };

    request.onerror = () => {
      cleanup();
      reject(new Error('Upload failed'));
    };
    request.onabort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };
    request.onload = () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1);
        resolve();
        return;
      }

      reject(new Error(`Upload failed (${String(request.status)})`));
    };

    request.send(file);
  });
}

export async function completeStudyImportUpload(importJobId: string): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await apiRequest<unknown>(`/imports/${encodeURIComponent(importJobId)}/complete`, {
      method: 'POST',
    })
  );
}

export async function cancelStudyImportUpload(importJobId: string): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await apiRequest<unknown>(`/imports/${encodeURIComponent(importJobId)}/cancel`, {
      method: 'POST',
    })
  );
}

export async function getCurrentStudyImport(
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult | null> {
  const response = unwrapLearningOsData(await apiRequest<unknown>('/imports/current', init));
  return response === null || typeof response === 'undefined'
    ? null
    : normalizeStudyImportResult(response);
}

export async function getStudyImportUploadReadiness(): Promise<StudyImportUploadReadiness> {
  const response = unwrapLearningOsData(await apiRequest<unknown>('/imports/readiness'));
  if (!isJsonRecord(response)) {
    throw new Error('Study import readiness response was malformed.');
  }
  return {
    ready: response.ready === true,
    message: typeof response.message === 'string' ? response.message : null,
  };
}

export async function getStudyImportStatus(
  importJobId: string,
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await apiRequest<unknown>(`/imports/${encodeURIComponent(importJobId)}`, init)
  );
}

export async function uploadStudyImport(file: File): Promise<StudyImportResult> {
  const session = await createStudyImportUploadSession(file);
  await uploadStudyImportArchive(session, file);
  return completeStudyImportUpload(session.importJob.id);
}
