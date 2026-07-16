import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  StudyCardCandidateCommitRequest,
  StudyCardCandidateCommitResponse,
  StudyCardCandidateGenerateRequest,
  StudyCardCandidateGenerateResponse,
  StudyCardCandidatePreviewAudioRequest,
  StudyCardCandidatePreviewAudioResponse,
  StudyCardCandidatePreviewImageRequest,
  StudyCardCandidatePreviewImageResponse,
  StudyCardCreationKind,
  StudyCardDraftCompleteRequest,
  StudyCardDraftCompleteResponse,
  StudyCardDraftImageRequest,
  StudyCardDraftImageResponse,
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
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { useFeatureFlags, type FeatureFlags } from './useFeatureFlags';

export interface StudySessionResponse {
  overview: StudyOverview;
  cards: StudyCardSummary[];
}

interface CreateStudyCardPayload {
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

type StudyApiFeature =
  | 'settings'
  | 'overview'
  | 'browser'
  | 'browserDetail'
  | 'newQueue'
  | 'imports'
  | 'settingsWrite'
  | 'newQueueWrite'
  | 'review';
const LEARNING_OS_STUDY_PROXY_BASE = '/api/learning-os/study';

const STUDY_API_FLAG_BY_FEATURE: Record<
  StudyApiFeature,
  keyof Pick<
    FeatureFlags,
    | 'studyApiSettings'
    | 'studyApiOverview'
    | 'studyApiBrowser'
    | 'studyApiBrowserDetail'
    | 'studyApiNewQueue'
    | 'studyApiImports'
    | 'studyApiSettingsWrite'
    | 'studyApiNewQueueWrite'
    | 'studyApiReview'
  >
> = {
  settings: 'studyApiSettings',
  overview: 'studyApiOverview',
  browser: 'studyApiBrowser',
  browserDetail: 'studyApiBrowserDetail',
  newQueue: 'studyApiNewQueue',
  imports: 'studyApiImports',
  settingsWrite: 'studyApiSettingsWrite',
  newQueueWrite: 'studyApiNewQueueWrite',
  review: 'studyApiReview',
};

const STUDY_API_READ_FLAG_BY_WRITE_FEATURE: Partial<
  Record<StudyApiFeature, 'studyApiSettings' | 'studyApiNewQueue'>
> = {
  settingsWrite: 'studyApiSettings',
  newQueueWrite: 'studyApiNewQueue',
};

interface StudyApiRouting {
  feature: StudyApiFeature;
  flags?: FeatureFlags;
}

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

function shouldUseLearningOsStudyApi(routing?: StudyApiRouting): boolean {
  if (!routing?.flags?.studyApiEnabled) {
    return false;
  }

  const readFlag = STUDY_API_READ_FLAG_BY_WRITE_FEATURE[routing.feature];
  return (
    routing.flags[STUDY_API_FLAG_BY_FEATURE[routing.feature]] === true &&
    (!readFlag || routing.flags[readFlag] === true)
  );
}

function studyApiRouteKey(feature: StudyApiFeature, flags?: FeatureFlags): string {
  return shouldUseLearningOsStudyApi({ feature, flags }) ? 'learning-os' : 'convo-lab';
}

async function apiRequest<T>(
  endpoint: string,
  init?: RequestInit,
  routing?: StudyApiRouting
): Promise<T> {
  if (shouldUseLearningOsStudyApi(routing)) {
    const headers = new Headers(withMutationHeaders(init));
    headers.set('Accept', 'application/json');
    const proxyEndpoint = endpoint.replace(/^\/api\/study(?=\/|$)/, LEARNING_OS_STUDY_PROXY_BASE);

    const response = await fetchWithCsrf(`${trimTrailingSlash(API_URL)}${proxyEndpoint}`, {
      ...init,
      credentials: 'include',
      headers,
    });

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

  const response = await fetchWithCsrf(`${API_URL}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: withMutationHeaders(init),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error?.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function startStudySession(flags?: FeatureFlags): Promise<StudySessionResponse> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudySessionResponse>(
    '/api/study/session/start',
    {
      method: 'POST',
      body: JSON.stringify({ timeZone }),
    },
    { feature: 'review', flags }
  );
}

export async function getStudySettings(flags?: FeatureFlags): Promise<StudySettings> {
  return apiRequest<StudySettings>('/api/study/settings', undefined, {
    feature: 'settings',
    flags,
  });
}

export async function updateStudySettings(
  payload: StudySettings,
  flags?: FeatureFlags
): Promise<StudySettings> {
  return apiRequest<StudySettings>(
    '/api/study/settings',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    { feature: 'settingsWrite', flags }
  );
}

export async function getStudyNewCardQueue(
  params: {
    cursor?: string | null;
    limit?: number;
    q?: string;
  } = {},
  flags?: FeatureFlags
): Promise<StudyNewCardQueueResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));
  if (params.q?.trim()) searchParams.set('q', params.q.trim());

  const suffix = searchParams.toString();
  return apiRequest<StudyNewCardQueueResponse>(
    `/api/study/new-queue${suffix ? `?${suffix}` : ''}`,
    undefined,
    { feature: 'newQueue', flags }
  );
}

export async function reorderStudyNewCardQueue(cardIds: string[], flags?: FeatureFlags) {
  return apiRequest<StudyNewCardQueueResponse>(
    '/api/study/new-queue/reorder',
    {
      method: 'POST',
      body: JSON.stringify({ cardIds }),
    },
    { feature: 'newQueueWrite', flags }
  );
}

export async function prepareStudyAnswerAudio(cardId: string): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(
    `/api/study/cards/${encodeURIComponent(cardId)}/prepare-answer-audio`,
    {
      method: 'POST',
    }
  );
}

export async function regenerateStudyAnswerAudio(
  payload: RegenerateStudyAnswerAudioPayload
): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(
    `/api/study/cards/${encodeURIComponent(payload.cardId)}/regenerate-answer-audio`,
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
    `/api/study/cards/${encodeURIComponent(payload.cardId)}/regenerate-image`,
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
  return apiRequest<StudyCardSummary>(
    `/api/study/cards/${encodeURIComponent(cardId)}/pitch-accent`,
    {
      method: 'POST',
    }
  );
}

export async function generateStudyCardCandidates(
  payload: StudyCardCandidateGenerateRequest
): Promise<StudyCardCandidateGenerateResponse> {
  return apiRequest<StudyCardCandidateGenerateResponse>('/api/study/card-candidates/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function commitStudyCardCandidates(
  payload: StudyCardCandidateCommitRequest
): Promise<StudyCardCandidateCommitResponse> {
  return apiRequest<StudyCardCandidateCommitResponse>('/api/study/card-candidates/commit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createStudyVocabBundleDrafts(
  payload: StudyVocabBundleGenerateRequest
): Promise<StudyVocabBundleDraftCreateResponse> {
  return apiRequest<StudyVocabBundleDraftCreateResponse>(
    '/api/study/card-candidates/vocab-bundle/drafts',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function regenerateStudyCardCandidatePreviewAudio(
  payload: StudyCardCandidatePreviewAudioRequest
): Promise<StudyCardCandidatePreviewAudioResponse> {
  return apiRequest<StudyCardCandidatePreviewAudioResponse>(
    '/api/study/card-candidates/regenerate-audio',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function regenerateStudyCardCandidatePreviewImage(
  payload: StudyCardCandidatePreviewImageRequest
): Promise<StudyCardCandidatePreviewImageResponse> {
  return apiRequest<StudyCardCandidatePreviewImageResponse>(
    '/api/study/card-candidates/regenerate-image',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function completeStudyCardDraft(
  payload: StudyCardDraftCompleteRequest
): Promise<StudyCardDraftCompleteResponse> {
  return apiRequest<StudyCardDraftCompleteResponse>('/api/study/cards/draft/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateStudyCardDraftImage(
  payload: StudyCardDraftImageRequest
): Promise<StudyCardDraftImageResponse> {
  return apiRequest<StudyCardDraftImageResponse>('/api/study/cards/draft/image', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getStudyManualCardDrafts(
  params: { cursor?: string | null; limit?: number } = {}
): Promise<StudyManualCardDraftListResponse> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));
  const suffix = searchParams.toString();
  return apiRequest<StudyManualCardDraftListResponse>(
    `/api/study/card-drafts${suffix ? `?${suffix}` : ''}`
  );
}

export async function createStudyManualCardDraft(
  payload: StudyManualCardDraftCreateRequest
): Promise<StudyManualCardDraft> {
  return apiRequest<StudyManualCardDraft>('/api/study/card-drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateStudyManualCardDraft(payload: {
  draftId: string;
  values: StudyManualCardDraftUpdateRequest;
}): Promise<StudyManualCardDraft> {
  return apiRequest<StudyManualCardDraft>(`/api/study/card-drafts/${payload.draftId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload.values),
  });
}

export async function retryStudyManualCardDraft(draftId: string): Promise<StudyManualCardDraft> {
  return apiRequest<StudyManualCardDraft>(`/api/study/card-drafts/${draftId}/retry`, {
    method: 'POST',
  });
}

export async function createCardFromStudyManualCardDraft(
  draftId: string
): Promise<StudyManualCardDraftCreateCardResponse> {
  return apiRequest<StudyManualCardDraftCreateCardResponse>(
    `/api/study/card-drafts/${draftId}/create-card`,
    {
      method: 'POST',
    }
  );
}

export async function deleteStudyManualCardDraft(draftId: string): Promise<void> {
  await apiRequest<unknown>(`/api/study/card-drafts/${draftId}`, {
    method: 'DELETE',
  });
}

export async function undoStudyReview(
  reviewLogId: string,
  currentOverview?: StudyOverview,
  flags?: FeatureFlags
): Promise<StudyUndoReviewResult> {
  const timeZone = getDeviceStudyTimeZone();
  return apiRequest<StudyUndoReviewResult>(
    '/api/study/reviews/undo',
    {
      method: 'POST',
      body: JSON.stringify({ reviewLogId, currentOverview, timeZone }),
    },
    { feature: 'review', flags }
  );
}

export async function submitStudyReview(
  payload: {
    cardId: string;
    grade: 'again' | 'hard' | 'good' | 'easy';
    durationMs?: number;
  },
  currentOverview?: StudyOverview,
  flags?: FeatureFlags
): Promise<StudyReviewResult> {
  return apiRequest<StudyReviewResult>(
    '/api/study/reviews',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        timeZone: getDeviceStudyTimeZone(),
        currentOverview,
      }),
    },
    { feature: 'review', flags }
  );
}

export async function getStudyBrowser(
  query: StudyBrowserQuery = {},
  flags?: FeatureFlags
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
  return apiRequest<StudyBrowserListResponse>(
    `/api/study/browser${suffix ? `?${suffix}` : ''}`,
    undefined,
    { feature: 'browser', flags }
  );
}

export async function getStudyBrowserNoteDetail(
  noteId: string,
  flags?: FeatureFlags
): Promise<StudyBrowserNoteDetail> {
  return apiRequest<StudyBrowserNoteDetail>(
    `/api/study/browser/${encodeURIComponent(noteId)}`,
    undefined,
    { feature: 'browserDetail', flags }
  );
}

export async function updateStudyCard(payload: UpdateStudyCardPayload): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(`/api/study/cards/${encodeURIComponent(payload.cardId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      prompt: payload.prompt,
      answer: payload.answer,
    }),
  });
}

export async function deleteStudyCard(cardId: string): Promise<void> {
  await apiRequest<unknown>(`/api/study/cards/${encodeURIComponent(cardId)}`, {
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

  return apiRequest<StudyCardActionResult>(
    `/api/study/cards/${encodeURIComponent(payload.cardId)}/actions`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

export function useStudyOverview(enabled: boolean) {
  const { flags } = useFeatureFlags();
  const timeZone = getDeviceStudyTimeZone();
  const searchParams = new URLSearchParams();
  if (timeZone) searchParams.set('timeZone', timeZone);
  const routeKey = studyApiRouteKey('overview', flags);

  return useQuery({
    queryKey: ['study', 'overview', routeKey],
    queryFn: () =>
      apiRequest<StudyOverview>(
        `/api/study/overview${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
        undefined,
        { feature: 'overview', flags }
      ),
    enabled,
    // The app-wide QueryClient disables focus refetches; study counts should refresh
    // when returning to the dashboard now that the manual refresh control is gone.
    refetchOnWindowFocus: true,
  });
}

export function useStudySettings(enabled: boolean) {
  const { flags } = useFeatureFlags();
  const routeKey = studyApiRouteKey('settings', flags);

  return useQuery({
    queryKey: ['study', 'settings', routeKey],
    queryFn: () => getStudySettings(flags),
    enabled,
  });
}

export function useStudyNewCardQueue(
  enabled: boolean,
  params: { cursor?: string | null; limit?: number; q?: string } = {}
) {
  const { flags } = useFeatureFlags();
  const routeKey = studyApiRouteKey('newQueue', flags);

  return useQuery({
    queryKey: [
      'study',
      'new-queue',
      routeKey,
      params.cursor ?? 'start',
      params.limit ?? 100,
      params.q ?? '',
    ],
    queryFn: () => getStudyNewCardQueue(params, flags),
    enabled,
  });
}

export function useUpdateStudySettings() {
  const queryClient = useQueryClient();
  const { flags } = useFeatureFlags();

  return useMutation({
    mutationFn: (payload: StudySettings) => updateStudySettings(payload, flags),
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
  const { flags } = useFeatureFlags();

  return useMutation({
    mutationFn: (cardIds: string[]) => reorderStudyNewCardQueue(cardIds, flags),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'new-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
      ]);
    },
  });
}

export function useStudyBrowser(enabled: boolean, query: StudyBrowserQuery) {
  const { flags } = useFeatureFlags();
  const routeKey = studyApiRouteKey('browser', flags);

  return useQuery({
    queryKey: ['study', 'browser', routeKey, query],
    queryFn: () => getStudyBrowser(query, flags),
    enabled,
  });
}

export function useStudyBrowserNoteDetail(enabled: boolean, noteId?: string) {
  const { flags } = useFeatureFlags();
  const routeKey = studyApiRouteKey('browserDetail', flags);

  return useQuery({
    queryKey: ['study', 'browser', 'note', routeKey, noteId ?? 'none'],
    queryFn: () => getStudyBrowserNoteDetail(noteId as string, flags),
    enabled: enabled && Boolean(noteId),
  });
}

export function useSubmitStudyReview(routingFlags?: FeatureFlags | null) {
  const queryClient = useQueryClient();
  const { flags: liveFlags } = useFeatureFlags();
  // null pins a session to the legacy API; undefined means no session snapshot exists yet.
  const effectiveFlags = routingFlags === undefined ? liveFlags : (routingFlags ?? undefined);

  return useMutation({
    mutationFn: (payload: {
      cardId: string;
      grade: 'again' | 'hard' | 'good' | 'easy';
      durationMs?: number;
    }) =>
      submitStudyReview(
        payload,
        queryClient.getQueryData<StudyOverview>(['study', 'overview']),
        effectiveFlags
      ),
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
    mutationFn: (payload: CreateStudyCardPayload) =>
      apiRequest<StudyCardSummary>('/api/study/cards', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
      ]);
    },
  });
}

export function useGenerateStudyCardCandidates() {
  return useMutation({
    mutationFn: generateStudyCardCandidates,
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

export function useCompleteStudyCardDraft() {
  return useMutation({
    mutationFn: completeStudyCardDraft,
  });
}

export function useGenerateStudyCardDraftImage() {
  return useMutation({
    mutationFn: generateStudyCardDraftImage,
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

  return useMutation({
    mutationFn: createCardFromStudyManualCardDraft,
    onSuccess: async () => {
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

export function useCommitStudyCardCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commitStudyCardCandidates,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'browser'] }),
      ]);
    },
  });
}

export function useRegenerateStudyCardCandidatePreviewAudio() {
  return useMutation({
    mutationFn: regenerateStudyCardCandidatePreviewAudio,
  });
}

export function useRegenerateStudyCardCandidatePreviewImage() {
  return useMutation({
    mutationFn: regenerateStudyCardCandidatePreviewImage,
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
  file: File,
  flags?: FeatureFlags
): Promise<StudyImportUploadSession> {
  return apiRequest<StudyImportUploadSession>(
    '/api/study/imports',
    {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      }),
    },
    { feature: 'imports', flags }
  );
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

export async function completeStudyImportUpload(
  importJobId: string,
  flags?: FeatureFlags
): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}/complete`,
    {
      method: 'POST',
    },
    { feature: 'imports', flags }
  );
}

export async function cancelStudyImportUpload(
  importJobId: string,
  flags?: FeatureFlags
): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}/cancel`,
    {
      method: 'POST',
    },
    { feature: 'imports', flags }
  );
}

export async function getCurrentStudyImport(
  init?: Pick<RequestInit, 'signal'>,
  flags?: FeatureFlags
): Promise<StudyImportResult | null> {
  return apiRequest<StudyImportResult | null>('/api/study/imports/current', init, {
    feature: 'imports',
    flags,
  });
}

export async function getStudyImportUploadReadiness(
  flags?: FeatureFlags
): Promise<StudyImportUploadReadiness> {
  return apiRequest<StudyImportUploadReadiness>('/api/study/imports/readiness', undefined, {
    feature: 'imports',
    flags,
  });
}

export async function getStudyImportStatus(
  importJobId: string,
  init?: Pick<RequestInit, 'signal'>,
  flags?: FeatureFlags
): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}`,
    init,
    { feature: 'imports', flags }
  );
}

export async function uploadStudyImport(
  file: File,
  flags?: FeatureFlags
): Promise<StudyImportResult> {
  const session = await createStudyImportUploadSession(file, flags);
  await uploadStudyImportArchive(session, file);
  return completeStudyImportUpload(session.importJob.id, flags);
}
