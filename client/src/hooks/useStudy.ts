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
  StudyIntroductionCohort,
  StudyLearningItemListResponse,
  StudyNewCardQueueResponse,
  StudyOverview,
  StudyPromptPayload,
  StudyReviewResult,
  StudySettings,
  StudyUndoReviewResult,
  StudyVocabBundleDraftCreateResponse,
  StudyVocabBundleGenerateRequest,
} from '@languageflow/shared/src/types';

import { JsonRequestError, requestJson } from '../lib/apiClient';
import StudyDraftRevisionConflictError from '../lib/studyDraftRevisionConflict';
import StudyReviewIdentityMismatchError from '../lib/studyReviewIdentityMismatch';
import useStudyMutationWithInvalidations from '../lib/studyQueryInvalidation';
import { decodeStudyCardSummary } from '../lib/learningOsContractDecoders';
import { studyApiPath } from '../lib/studyApi';
import {
  getStudyBrowser,
  getStudyBrowserNoteDetail,
  type StudyBrowserQuery,
} from '../lib/studyBrowseApi';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import {
  getStudyLearningPath,
  linkStudyLearningPathSuccessor,
  type StudyLearningPath,
  type StudyLearningPathCard,
  type StudyLearningPathStage,
  type StudyLearningPathUnlockRequirement,
  type StudyLearningPathVariantStatus,
} from '../lib/studyLearningPathApi';

export { getStudyBrowser, getStudyBrowserNoteDetail };
export type { StudyBrowserQuery };
export { getStudyLearningPath, linkStudyLearningPathSuccessor };
export {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createStudyImportUploadSession,
  getCurrentStudyImport,
  getStudyImportStatus,
  getStudyImportUploadReadiness,
  uploadStudyImport,
  uploadStudyImportArchive,
} from '../lib/studyImportApi';
export type {
  StudyLearningPath,
  StudyLearningPathCard,
  StudyLearningPathStage,
  StudyLearningPathUnlockRequirement,
  StudyLearningPathVariantStatus,
};

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
  expectedRevision: number;
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
}

interface StudyQueryOptions {
  enabled: boolean;
}

interface StudySearchQueryOptions extends StudyQueryOptions {
  query?: string;
}

interface StudyOverviewQueryOptions extends StudyQueryOptions {
  refetchOnMount?: boolean | 'always';
}

interface StudyLearningPathQueryOptions extends StudyQueryOptions {
  cardId: string;
}

interface StudyBrowserQueryOptions extends StudyQueryOptions {
  query: StudyBrowserQuery;
}

interface StudyBrowserNoteQueryOptions extends StudyQueryOptions {
  noteId?: string;
}

interface StudyManualCardDraftQueryOptions {
  effectiveOwnerId: string | null;
}

export interface StudyReviewRequest {
  cardId: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  durationMs?: number;
  clientReviewId: string;
  reviewedAt: string;
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

export async function startStudyIntroductionCohortLesson(
  cohortId: string
): Promise<StudySessionResponse> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudySessionResponse>(
    `/introduction-cohorts/${encodeURIComponent(cohortId)}/lessons/start`,
    {
      method: 'POST',
      body: JSON.stringify({ timeZone }),
    }
  );
}

export async function createStudyLessonFollowupCohort(payload: {
  cohortId: string;
  cardIds: string[];
  label?: string | null;
}): Promise<StudyIntroductionCohort> {
  return apiRequest<StudyIntroductionCohort>('/introduction-cohorts/lesson-followup', {
    method: 'POST',
    body: JSON.stringify(payload),
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

export async function getStudyLearningItems(
  params: { cursor?: string | null; limit?: number; q?: string } = {}
): Promise<StudyLearningItemListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (typeof params.limit === 'number') searchParams.set('per_page', String(params.limit));
  if (params.q?.trim()) searchParams.set('q', params.q.trim());

  const suffix = searchParams.toString();
  return apiRequest<StudyLearningItemListResponse>(`/learning-items${suffix ? `?${suffix}` : ''}`);
}

export async function reorderStudyNewCardQueue(payload: { cardIds: string[] }) {
  return apiRequest<StudyNewCardQueueResponse>('/new-queue/reorder', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function promoteStudyNewCardToFront(cardId: string) {
  return apiRequest<StudyNewCardQueueResponse>(`/new-queue/${encodeURIComponent(cardId)}/promote`, {
    method: 'POST',
  });
}

export async function prepareStudyAnswerAudio(cardId: string): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>(`/cards/${encodeURIComponent(cardId)}/prepare-answer-audio`, {
      method: 'POST',
    })
  );
}

export async function regenerateStudyAnswerAudio(
  payload: RegenerateStudyAnswerAudioPayload
): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>(
      `/cards/${encodeURIComponent(payload.cardId)}/regenerate-answer-audio`,
      {
        method: 'POST',
        body: JSON.stringify({
          answerAudioVoiceId: payload.answerAudioVoiceId,
          answerAudioTextOverride: payload.answerAudioTextOverride,
        }),
      }
    )
  );
}

export async function regenerateStudyCardImage(
  payload: RegenerateStudyCardImagePayload
): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>(`/cards/${encodeURIComponent(payload.cardId)}/regenerate-image`, {
      method: 'POST',
      body: JSON.stringify({
        imagePrompt: payload.imagePrompt,
        imageRole: payload.imageRole,
      }),
    })
  );
}

export async function resolveStudyCardPitchAccent(cardId: string): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>(`/cards/${encodeURIComponent(cardId)}/pitch-accent`, {
      method: 'POST',
    })
  );
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

export function createStudyIntroductionCohortId(): string {
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
  const card = decodeStudyCardSummary(
    await apiRequest<unknown>(`/card-drafts/${draftId}/create-card`, {
      method: 'POST',
      body: JSON.stringify({ id: cardId }),
    })
  );
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

export async function undoStudyReview(reviewLogId: string): Promise<StudyUndoReviewResult> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudyUndoReviewResult>('/reviews/undo', {
    method: 'POST',
    body: JSON.stringify({ reviewLogId, timeZone }),
  });
}

export async function submitStudyReview(payload: StudyReviewRequest): Promise<StudyReviewResult> {
  const result = await apiRequest<StudyReviewResult>('/reviews', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      timeZone: getDeviceStudyTimeZone(),
    }),
  });

  if (result.reviewLogId !== payload.clientReviewId) {
    throw new StudyReviewIdentityMismatchError(payload.clientReviewId, result.reviewLogId);
  }

  return result;
}

export function createStudyReviewRequest(payload: {
  cardId: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  durationMs?: number;
}): StudyReviewRequest {
  return {
    ...payload,
    // The Learning OS review contract normalizes client-supplied ULIDs to lowercase.
    clientReviewId: ulid().toLowerCase(),
    reviewedAt: new Date().toISOString(),
  };
}

export async function createStudyCard(payload: CreateStudyCardPayload): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>('/cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}

export async function updateStudyCard(payload: UpdateStudyCardPayload): Promise<StudyCardSummary> {
  return decodeStudyCardSummary(
    await apiRequest<unknown>(`/cards/${encodeURIComponent(payload.cardId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        prompt: payload.prompt,
        answer: payload.answer,
        expectedRevision: payload.expectedRevision,
      }),
    })
  );
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
  };

  return apiRequest<StudyCardActionResult>(`/cards/${encodeURIComponent(payload.cardId)}/actions`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function useStudyOverview({ enabled, refetchOnMount = true }: StudyOverviewQueryOptions) {
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
    refetchOnMount,
    // The app-wide QueryClient disables focus refetches; study counts should refresh
    // when returning to the dashboard now that the manual refresh control is gone.
    refetchOnWindowFocus: true,
  });
}

export function useStudySettings({ enabled }: StudyQueryOptions) {
  return useQuery({
    queryKey: ['study', 'settings'],
    queryFn: getStudySettings,
    enabled,
  });
}

export function useStudyNewCardQueueInfinite({ enabled, query: q = '' }: StudySearchQueryOptions) {
  return useInfiniteQuery({
    queryKey: ['study', 'new-queue', 'infinite', q],
    queryFn: ({ pageParam }) => getStudyNewCardQueue({ cursor: pageParam, limit: 50, q }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useStudyCardsInfinite({ enabled, query: q = '' }: StudySearchQueryOptions) {
  return useInfiniteQuery({
    queryKey: ['study', 'cards', 'infinite', q],
    queryFn: ({ pageParam }) => getStudyCards({ cursor: pageParam, limit: 50, q }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useStudyLearningItemsInfinite({ enabled, query: q = '' }: StudySearchQueryOptions) {
  return useInfiniteQuery({
    queryKey: ['study', 'learning-items', 'infinite', q],
    queryFn: ({ pageParam }) => getStudyLearningItems({ cursor: pageParam, limit: 20, q }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useStudyLearningPath({ cardId, enabled }: StudyLearningPathQueryOptions) {
  return useQuery({
    queryKey: ['study', 'learning-path', cardId],
    queryFn: () => getStudyLearningPath(cardId),
    enabled: enabled && Boolean(cardId),
  });
}

export function useLinkStudyLearningPathSuccessor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkStudyLearningPathSuccessor,
    onSuccess: async (path, payload) => {
      queryClient.setQueryData(['study', 'learning-path', payload.cardId], path);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'learning-path'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'cards'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'learning-items'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'new-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
      ]);
    },
  });
}

export function useUpdateStudySettings() {
  return useStudyMutationWithInvalidations(updateStudySettings, ['settings', 'overview']);
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

export function useCreateStudyLessonFollowupCohort() {
  return useStudyMutationWithInvalidations(createStudyLessonFollowupCohort, [
    'new-queue',
    'overview',
    'cards',
  ]);
}

export function usePromoteStudyNewCardToFront() {
  return useStudyMutationWithInvalidations(promoteStudyNewCardToFront, ['new-queue', 'overview']);
}

export function useStudyBrowser({ enabled, query }: StudyBrowserQueryOptions) {
  return useQuery({
    queryKey: ['study', 'browser', query],
    queryFn: ({ signal }) => getStudyBrowser(query, { signal }),
    enabled,
  });
}

export function useStudyBrowserNoteDetail({ enabled, noteId }: StudyBrowserNoteQueryOptions) {
  return useQuery({
    queryKey: ['study', 'browser', 'note', noteId ?? 'none'],
    queryFn: ({ signal }) => getStudyBrowserNoteDetail(noteId as string, { signal }),
    enabled: enabled && Boolean(noteId),
  });
}

export function useSubmitStudyReview() {
  return useStudyMutationWithInvalidations(submitStudyReview, ['session', 'overview']);
}

export function useCreateStudyCard() {
  return useStudyMutationWithInvalidations(createStudyCard, ['overview', 'session']);
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

export function useStudyManualCardDrafts({ effectiveOwnerId }: StudyManualCardDraftQueryOptions) {
  return useInfiniteQuery({
    queryKey: ['study', 'manual-card-drafts', effectiveOwnerId],
    queryFn: ({ pageParam }) => getStudyManualCardDrafts({ cursor: pageParam, limit: 200 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: effectiveOwnerId !== null,
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
  return useStudyMutationWithInvalidations(updateStudyCard, ['browser', 'export']);
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
  return useStudyMutationWithInvalidations(performStudyCardAction, ['browser', 'export']);
}
