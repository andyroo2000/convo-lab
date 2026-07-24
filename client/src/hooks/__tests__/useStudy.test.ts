import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME, fetchWithCsrf } from '../../lib/csrf';
import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createCardFromStudyManualCardDraft,
  createStudyCard,
  createStudyCardId,
  createStudyImportUploadSession,
  createStudyManualCardDraft,
  createStudyVocabBundleDrafts,
  deleteStudyCard,
  deleteStudyManualCardDraft,
  generateStudyManualCardDraftPreviewAudio,
  generateStudyManualCardDraftPreviewImage,
  getCurrentStudyImport,
  getStudyBrowser,
  getStudyBrowserNoteDetail,
  getStudyImportStatus,
  getStudyImportUploadReadiness,
  getStudyManualCardDrafts,
  getStudyNewCardQueue,
  getStudySettings,
  performStudyCardAction,
  prepareStudyAnswerAudio,
  regenerateStudyAnswerAudio,
  regenerateStudyCardImage,
  reorderStudyNewCardQueue,
  resolveStudyCardPitchAccent,
  retryStudyManualCardDraft,
  startStudySession,
  submitStudyReview,
  undoStudyReview,
  updateStudyCard,
  updateStudyManualCardDraft,
  updateStudySettings,
  uploadStudyImport,
  uploadStudyImportArchive,
} from '../useStudy';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
  SHOW_ONBOARDING_WELCOME: false,
}));

const STUDY_API_BASE = '/api/study';

describe('useStudy request helpers', () => {
  class MockXMLHttpRequest {
    static lastInstance: MockXMLHttpRequest | null = null;

    method = '';

    url = '';

    requestHeaders = new Map<string, string>();

    status = 200;

    upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };

    onerror: (() => void) | null = null;

    onabort: (() => void) | null = null;

    onload: (() => void) | null = null;

    constructor() {
      MockXMLHttpRequest.lastInstance = this;
    }

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders.set(name, value);
    }

    send() {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 1,
      } as ProgressEvent<EventTarget>);
      this.onload?.();
    }
  }

  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token`;
          return { ok: true, status: 204 } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      })
    );
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
    await fetchWithCsrf('/api/study/test-csrf-setup', { method: 'POST' });
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  function expectJsonMutation(callIndex: number) {
    const requestInit = vi.mocked(global.fetch).mock.calls[callIndex]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
  }

  it('routes session start, review, and undo through Learning OS', async () => {
    await startStudySession();
    await submitStudyReview(
      { cardId: '123e4567-e89b-42d3-a456-426614174000', grade: 'good', durationMs: 1250 },
      undefined
    );
    await undoStudyReview('review-log-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${STUDY_API_BASE}/session/start`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${STUDY_API_BASE}/reviews`, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${STUDY_API_BASE}/reviews/undo`,
      expect.any(Object)
    );
    expectJsonMutation(0);
    expectJsonMutation(1);
    expectJsonMutation(2);
  });

  it('sends device timezone and current overview with review operations', async () => {
    const overview = {
      dueCount: 1,
      newCount: 0,
      learningCount: 0,
      reviewCount: 1,
      suspendedCount: 0,
      totalCards: 1,
    };

    await submitStudyReview({ cardId: 'card-1', grade: 'hard' }, overview);
    await undoStudyReview('review-log-1', overview);

    const fetchMock = vi.mocked(global.fetch);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      cardId: 'card-1',
      grade: 'hard',
      currentOverview: overview,
      timeZone: expect.any(String),
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      reviewLogId: 'review-log-1',
      currentOverview: overview,
      timeZone: expect.any(String),
    });
  });

  it('routes card CRUD, actions, and generated media through Learning OS', async () => {
    const cardId = createStudyCardId();
    const prompt = { cueText: '会社' };
    const answer = { expression: '会社', meaning: 'company' };

    await createStudyCard({
      id: cardId,
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt,
      answer,
    });
    await updateStudyCard({ cardId, prompt, answer });
    await performStudyCardAction({ cardId, action: 'suspend' });
    await prepareStudyAnswerAudio(cardId);
    await regenerateStudyAnswerAudio({
      cardId,
      answerAudioVoiceId: 'voice-1',
      answerAudioTextOverride: 'かいしゃ',
    });
    await regenerateStudyCardImage({ cardId, imagePrompt: 'An office', imageRole: 'answer' });
    await resolveStudyCardPitchAccent(cardId);
    await deleteStudyCard(cardId);

    const paths = vi
      .mocked(global.fetch)
      .mock.calls.map(([url]) => String(url).replace(STUDY_API_BASE, ''));
    expect(paths).toEqual([
      '/cards',
      `/cards/${cardId}`,
      `/cards/${cardId}/actions`,
      `/cards/${cardId}/prepare-answer-audio`,
      `/cards/${cardId}/regenerate-answer-audio`,
      `/cards/${cardId}/regenerate-image`,
      `/cards/${cardId}/pitch-accent`,
      `/cards/${cardId}`,
    ]);
    expect(new Set(paths)).not.toContain('/api/study');
  });

  it('reuses a caller-owned card ID when card creation is retried', async () => {
    const cardId = createStudyCardId();
    const payload = {
      id: cardId,
      cardType: 'recognition' as const,
      prompt: { cueText: '学校' },
      answer: { expression: '学校', meaning: 'school' },
    };

    await createStudyCard(payload);
    await createStudyCard(payload);

    const bodies = vi
      .mocked(global.fetch)
      .mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([payload, payload]);
  });

  it('routes the durable manual-card draft lifecycle through Learning OS', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const draftRequest = {
      creationKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: '猫' },
      answer: { expression: '猫', meaning: 'cat' },
      imagePlacement: 'answer' as const,
      imagePrompt: 'A cat',
    };

    await getStudyManualCardDrafts({ cursor: draftId, limit: 50 });
    await createStudyManualCardDraft(draftRequest);
    await updateStudyManualCardDraft({
      draftId,
      values: { prompt: draftRequest.prompt, answer: draftRequest.answer },
    });
    await retryStudyManualCardDraft(draftId);
    await generateStudyManualCardDraftPreviewAudio(draftId);
    await generateStudyManualCardDraftPreviewImage(draftId);
    await createCardFromStudyManualCardDraft(draftId, cardId);
    await deleteStudyManualCardDraft(draftId);
    await createStudyVocabBundleDrafts({
      targetWord: '猫',
      sourceSentence: null,
      context: '',
      includeLearnerContext: true,
    });

    const paths = vi
      .mocked(global.fetch)
      .mock.calls.map(([url]) => String(url).replace(STUDY_API_BASE, ''));
    expect(paths).toEqual([
      `/card-drafts?cursor=${draftId}&limit=50`,
      '/card-drafts',
      `/card-drafts/${draftId}`,
      `/card-drafts/${draftId}/retry`,
      `/card-drafts/${draftId}/preview-audio`,
      `/card-drafts/${draftId}/preview-image`,
      `/card-drafts/${draftId}/create-card`,
      `/card-drafts/${draftId}`,
      '/card-candidates/vocab-bundle/drafts',
    ]);

    const previewCalls = [4, 5].map(
      (index) => vi.mocked(global.fetch).mock.calls[index]?.[1] as RequestInit
    );
    previewCalls.forEach((init) => {
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).get('Content-Type')).toBeNull();
    });
  });

  it('routes settings, queue, and browser reads and writes through Learning OS', async () => {
    await getStudySettings();
    await updateStudySettings({ newCardsPerDay: 15 });
    await getStudyNewCardQueue({ cursor: 'cursor-1', q: 'kana', limit: 25 });
    await reorderStudyNewCardQueue(['card-2', 'card-1']);
    await getStudyBrowser({
      q: '学校',
      sortField: 'created_on',
      sortDirection: 'desc',
      limit: 25,
    });
    await getStudyBrowserNoteDetail('note/with spaces');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/settings`,
      `${STUDY_API_BASE}/settings`,
      `${STUDY_API_BASE}/new-queue?cursor=cursor-1&limit=25&q=kana`,
      `${STUDY_API_BASE}/new-queue/reorder`,
      `${STUDY_API_BASE}/browser?q=%E5%AD%A6%E6%A0%A1&sortField=created_on&sortDirection=desc&limit=25`,
      `${STUDY_API_BASE}/browser/note%2Fwith%20spaces`,
    ]);

    const readHeaders = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(readHeaders.get('Accept')).toBe('application/json');
    expect(readHeaders.get('Content-Type')).toBeNull();
    expect(readHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBeNull();
    expectJsonMutation(1);
    expectJsonMutation(3);
  });

  it('notifies the app only when Learning OS reports an expired session', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response);

    await expect(getStudySettings()).rejects.toThrow('Unauthorized (401)');
    expect(expiredListener).toHaveBeenCalledTimes(1);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: { message: 'Learning OS unavailable' } }),
    } as Response);
    await expect(getStudySettings()).rejects.toThrow('Learning OS unavailable (502)');
    expect(expiredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
  });

  it('routes the complete import lifecycle through Learning OS', async () => {
    const importId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const uploadUrl = `/api/study/imports/${importId}/upload`;
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          importJob: { id: importId, status: 'awaiting_upload' },
          upload: {
            method: 'PUT',
            url: uploadUrl,
            headers: { 'Content-Type': 'application/octet-stream' },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ id: importId, status: 'pending' }),
      } as Response);

    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    const result = await uploadStudyImport(file);

    expect(result).toEqual({ id: importId, status: 'pending' });
    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/imports`,
      `${STUDY_API_BASE}/imports/${importId}/complete`,
    ]);
    expect(MockXMLHttpRequest.lastInstance?.method).toBe('PUT');
    expect(MockXMLHttpRequest.lastInstance?.url).toBe(uploadUrl);
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
  });

  it('routes import status, readiness, completion, and cancellation through Learning OS', async () => {
    const importId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    await getCurrentStudyImport();
    await getStudyImportUploadReadiness();
    await getStudyImportStatus(importId);
    await completeStudyImportUpload(importId);
    await cancelStudyImportUpload(importId);

    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/imports/current`,
      `${STUDY_API_BASE}/imports/readiness`,
      `${STUDY_API_BASE}/imports/${importId}`,
      `${STUDY_API_BASE}/imports/${importId}/complete`,
      `${STUDY_API_BASE}/imports/${importId}/cancel`,
    ]);
  });

  it('attaches the shared CSRF token header to direct import uploads', async () => {
    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    await uploadStudyImportArchive(
      {
        importJob: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          status: 'pending',
          sourceFilename: 'deck.colpkg',
          deckName: 'Deck',
          preview: {
            deckName: 'Deck',
            cardCount: 1,
            noteCount: 1,
            reviewLogCount: 0,
            mediaReferenceCount: 0,
            skippedMediaCount: 0,
            warnings: [],
            noteTypeBreakdown: [],
          },
        },
        upload: {
          method: 'PUT',
          url: '/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
          headers: { 'Content-Type': 'application/octet-stream' },
        },
      },
      file
    );

    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
  });

  it('creates import sessions with the Learning OS proxy contract', async () => {
    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    await createStudyImportUploadSession(file);

    expect(global.fetch).toHaveBeenCalledWith(`${STUDY_API_BASE}/imports`, expect.any(Object));
    const requestInit = vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      filename: 'deck.colpkg',
      contentType: 'application/octet-stream',
    });
  });
});
