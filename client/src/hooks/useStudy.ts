import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STUDY_HISTORY_PAGE_SIZE_DEFAULT } from '@languageflow/shared/src/studyConstants';
import type {
  StudyAnswerPayload,
  StudyCardActionName,
  StudyCardActionRequest,
  StudyCardActionResult,
  StudyCardOptionsResponse,
  StudyCardSetDueMode,
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyCardSummary,
  StudyExportManifest,
  StudyHistoryResponse,
  StudyImportResult,
  StudyImportUploadReadiness,
  StudyImportUploadSession,
  StudyOverview,
  StudyPromptPayload,
  StudyReviewResult,
  StudyUndoReviewResult,
} from '@languageflow/shared/src/types';

import { API_URL } from '../config';
import { fetchWithCsrf } from '../lib/csrf';

export interface StudySessionResponse {
  overview: StudyOverview;
  cards: StudyCardSummary[];
}

interface CreateStudyCardPayload {
  cardType: 'recognition' | 'production' | 'cloze';
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface UpdateStudyCardPayload {
  cardId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
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
  cursor?: string;
  limit?: number;
}

function withMutationHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers ?? {});
  const method = (init?.method ?? 'GET').toUpperCase();

  if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function apiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithCsrf(`${API_URL}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: withMutationHeaders(init),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error?.message || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export async function startStudySession(limit: number = 20): Promise<StudySessionResponse> {
  return apiRequest<StudySessionResponse>('/api/study/session/start', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export async function prepareStudyAnswerAudio(cardId: string): Promise<StudyCardSummary> {
  return apiRequest<StudyCardSummary>(
    `/api/study/cards/${encodeURIComponent(cardId)}/prepare-answer-audio`,
    {
      method: 'POST',
    }
  );
}

export async function undoStudyReview(
  reviewLogId: string,
  currentOverview?: StudyOverview
): Promise<StudyUndoReviewResult> {
  return apiRequest<StudyUndoReviewResult>('/api/study/reviews/undo', {
    method: 'POST',
    body: JSON.stringify({ reviewLogId, currentOverview }),
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
  if (query.cursor) searchParams.set('cursor', query.cursor);
  if (typeof query.limit === 'number') searchParams.set('limit', String(query.limit));

  const suffix = searchParams.toString();
  return apiRequest<StudyBrowserListResponse>(`/api/study/browser${suffix ? `?${suffix}` : ''}`);
}

export async function getStudyBrowserNoteDetail(noteId: string): Promise<StudyBrowserNoteDetail> {
  return apiRequest<StudyBrowserNoteDetail>(`/api/study/browser/${encodeURIComponent(noteId)}`);
}

export async function getStudyCardOptions(limit: number = 100): Promise<StudyCardOptionsResponse> {
  return apiRequest<StudyCardOptionsResponse>(
    `/api/study/cards/options?limit=${encodeURIComponent(String(limit))}`
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

export function useStudyHistoryPage(
  enabled: boolean,
  params: { cardId?: string; cursor?: string; limit?: number }
) {
  const searchParams = new URLSearchParams();
  if (params.cardId) {
    searchParams.set('cardId', params.cardId);
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }

  return useQuery({
    queryKey: [
      'study',
      'history',
      params.cardId ?? 'all',
      params.cursor ?? 'start',
      params.limit ?? 50,
    ],
    queryFn: () =>
      apiRequest<StudyHistoryResponse>(`/api/study/history?${searchParams.toString()}`),
    enabled,
  });
}

export function useStudyOverview(enabled: boolean) {
  return useQuery({
    queryKey: ['study', 'overview'],
    queryFn: () => apiRequest<StudyOverview>('/api/study/overview'),
    enabled,
  });
}

export function useStudyHistory(enabled: boolean, cardId?: string) {
  return useStudyHistoryPage(enabled, {
    cardId,
    limit: STUDY_HISTORY_PAGE_SIZE_DEFAULT,
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

export function useStudyExport(enabled: boolean) {
  return useQuery({
    queryKey: ['study', 'export'],
    queryFn: () => apiRequest<StudyExportManifest>('/api/study/export'),
    enabled,
  });
}

export function useStudyCardOptions(enabled: boolean, limit: number = 100) {
  return useQuery({
    queryKey: ['study', 'card-options', limit],
    queryFn: () => getStudyCardOptions(limit),
    enabled,
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
      apiRequest<StudyReviewResult>('/api/study/reviews', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          currentOverview: queryClient.getQueryData<StudyOverview>(['study', 'overview']),
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['study', 'session'] }),
        queryClient.invalidateQueries({ queryKey: ['study', 'history'] }),
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
  return apiRequest<StudyImportUploadSession>('/api/study/imports', {
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
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}/complete`,
    {
      method: 'POST',
    }
  );
}

export async function cancelStudyImportUpload(importJobId: string): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}/cancel`,
    {
      method: 'POST',
    }
  );
}

export async function getCurrentStudyImport(
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult | null> {
  return apiRequest<StudyImportResult | null>('/api/study/imports/current', init);
}

export async function getStudyImportUploadReadiness(): Promise<StudyImportUploadReadiness> {
  return apiRequest<StudyImportUploadReadiness>('/api/study/imports/readiness');
}

export async function getStudyImportStatus(
  importJobId: string,
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult> {
  return apiRequest<StudyImportResult>(
    `/api/study/imports/${encodeURIComponent(importJobId)}`,
    init
  );
}

export async function uploadStudyImport(file: File): Promise<StudyImportResult> {
  const session = await createStudyImportUploadSession(file);
  await uploadStudyImportArchive(session, file);
  return completeStudyImportUpload(session.importJob.id);
}
