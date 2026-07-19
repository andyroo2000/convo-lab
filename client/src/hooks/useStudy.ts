import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ulid } from 'ulid';
import type {
  StudyAnswerPayload,
  StudyCardActionName,
  StudyCardActionRequest,
  StudyCardActionResult,
  StudyCardSetDueMode,
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyBrowserSortDirection,
  StudyBrowserSortField,
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

import { API_URL } from '../config';
import { CSRF_TOKEN_HEADER_NAME, fetchWithCsrf, getCsrfToken } from '../lib/csrf';
import { notifyAuthSessionExpired } from '../lib/authSession';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';

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

const LEARNING_OS_STUDY_PROXY_BASE = '/api/learning-os/study';

function withMutationHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers ?? {});
  const method = (init?.method ?? 'GET').toUpperCase();
  const hasBody = typeof init?.body !== 'undefined' && init.body !== null;

  if (hasBody && !headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function apiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(withMutationHeaders(init));
  headers.set('Accept', 'application/json');
  const proxyEndpoint = `${LEARNING_OS_STUDY_PROXY_BASE}${endpoint}`;
  const response = await fetchWithCsrf(`${trimTrailingSlash(API_URL)}${proxyEndpoint}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  notifyAuthSessionExpired(response);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const message = error.message || error.error?.message || 'Request failed';
    throw new Error(`${message} (${String(response.status)})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function startStudySession(): Promise<StudySessionResponse> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudySessionResponse>('/session/start', {
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

export async function reorderStudyNewCardQueue(cardIds: string[]) {
  return apiRequest<StudyNewCardQueueResponse>('/new-queue/reorder', {
    method: 'POST',
    body: JSON.stringify({ cardIds }),
  });
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
  return apiRequest<StudyManualCardDraft>(`/card-drafts/${payload.draftId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload.values),
  });
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
  return apiRequest<StudyManualCardDraftCreateCardResponse>(`/card-drafts/${draftId}/create-card`, {
    method: 'POST',
    body: JSON.stringify({ id: cardId }),
  });
}

export async function deleteStudyManualCardDraft(draftId: string): Promise<void> {
  await apiRequest<unknown>(`/card-drafts/${draftId}`, {
    method: 'DELETE',
  });
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

export async function getStudyBrowser(
  query: StudyBrowserQuery = {}
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
  return apiRequest<StudyBrowserListResponse>(`/browser${suffix ? `?${suffix}` : ''}`);
}

export async function getStudyBrowserNoteDetail(noteId: string): Promise<StudyBrowserNoteDetail> {
  return apiRequest<StudyBrowserNoteDetail>(`/browser/${encodeURIComponent(noteId)}`);
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

export function useStudyNewCardQueue(
  enabled: boolean,
  params: { cursor?: string | null; limit?: number; q?: string } = {}
) {
  return useQuery({
    queryKey: ['study', 'new-queue', params.cursor ?? 'start', params.limit ?? 100, params.q ?? ''],
    queryFn: () => getStudyNewCardQueue(params),
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
    queryFn: () => getStudyBrowser(query),
    enabled,
  });
}

export function useStudyBrowserNoteDetail(enabled: boolean, noteId?: string) {
  return useQuery({
    queryKey: ['study', 'browser', 'note', noteId ?? 'none'],
    queryFn: () => getStudyBrowserNoteDetail(noteId as string),
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
    mutationFn: (draftId: string) => {
      const cardId = pendingCardIds.current.get(draftId) ?? createStudyCardId();
      pendingCardIds.current.set(draftId, cardId);
      return createCardFromStudyManualCardDraft(draftId, cardId);
    },
    onSuccess: async (_result, draftId) => {
      pendingCardIds.current.delete(draftId);
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
  return apiRequest<StudyImportUploadSession>('/imports', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });
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
  return apiRequest<StudyImportResult>(`/imports/${encodeURIComponent(importJobId)}/complete`, {
    method: 'POST',
  });
}

export async function cancelStudyImportUpload(importJobId: string): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(`/imports/${encodeURIComponent(importJobId)}/cancel`, {
    method: 'POST',
  });
}

export async function getCurrentStudyImport(
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult | null> {
  return apiRequest<StudyImportResult | null>('/imports/current', init);
}

export async function getStudyImportUploadReadiness(): Promise<StudyImportUploadReadiness> {
  return apiRequest<StudyImportUploadReadiness>('/imports/readiness');
}

export async function getStudyImportStatus(
  importJobId: string,
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(`/imports/${encodeURIComponent(importJobId)}`, init);
}

export async function uploadStudyImport(file: File): Promise<StudyImportResult> {
  const session = await createStudyImportUploadSession(file);
  await uploadStudyImportArchive(session, file);
  return completeStudyImportUpload(session.importJob.id);
}
