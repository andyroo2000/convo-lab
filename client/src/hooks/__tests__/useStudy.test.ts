import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import type { FeatureFlags } from '../useFeatureFlags';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME } from '../../lib/csrf';
import {
  cancelStudyImportUpload,
  commitStudyCardCandidates,
  createCardFromStudyManualCardDraft,
  createStudyCard,
  createStudyCardId,
  createStudyManualCardDraft,
  createStudyVocabBundleDrafts,
  deleteStudyManualCardDraft,
  deleteStudyCard,
  getCurrentStudyImport,
  getStudyNewCardQueue,
  getStudySettings,
  generateStudyCardCandidates,
  getStudyBrowser,
  getStudyBrowserNoteDetail,
  getStudyImportStatus,
  getStudyImportUploadReadiness,
  getStudyManualCardDrafts,
  generateStudyManualCardDraftPreviewAudio,
  generateStudyManualCardDraftPreviewImage,
  regenerateStudyCardCandidatePreviewAudio,
  regenerateStudyCardCandidatePreviewImage,
  regenerateStudyAnswerAudio,
  regenerateStudyCardImage,
  reorderStudyNewCardQueue,
  resolveStudyCardPitchAccent,
  performStudyCardAction,
  prepareStudyAnswerAudio,
  startStudySession,
  submitStudyReview,
  retryStudyManualCardDraft,
  undoStudyReview,
  updateStudyCard,
  updateStudyManualCardDraft,
  updateStudySettings,
  uploadStudyImport,
} from '../useStudy';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
  SHOW_ONBOARDING_WELCOME: false,
}));

describe('useStudy request helpers', () => {
  const featureFlags = (overrides: Partial<FeatureFlags> = {}): FeatureFlags => ({
    id: 'flags-1',
    dialoguesEnabled: true,
    scriptsEnabled: true,
    audioCourseEnabled: true,
    flashcardsEnabled: true,
    studyApiEnabled: false,
    studyApiSettings: false,
    studyApiOverview: false,
    studyApiBrowser: false,
    studyApiBrowserDetail: false,
    studyApiNewQueue: false,
    studyApiImports: false,
    studyApiSettingsWrite: false,
    studyApiNewQueueWrite: false,
    studyApiReview: false,
    studyApiCardWrites: false,
    studyApiCardDrafts: false,
    studyApiMedia: false,
    updatedAt: new Date('2026-07-14T00:00:00.000Z').toISOString(),
    ...overrides,
  });

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

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token`;
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  it('starts study sessions with device timezone and CSRF headers', async () => {
    await startStudySession();

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/session/start`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      timeZone: expect.any(String),
    });
  });

  it('routes session start and undo together when Study Review is enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiReview: true,
    });

    await startStudySession(flags);
    await submitStudyReview(
      { cardId: '123e4567-e89b-42d3-a456-426614174000', grade: 'good', durationMs: 1250 },
      undefined,
      flags
    );
    await undoStudyReview('review-log-1', undefined, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/api/learning-os/study/session/start`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/api/learning-os/study/reviews`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/learning-os/study/reviews/undo`,
      expect.any(Object)
    );
    fetchMock.mock.calls.forEach(([, requestInit]) => {
      const headers = new Headers((requestInit as RequestInit).headers);
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    });
  });

  it('keeps the whole review flow on Convo Lab until its child flag is enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiReview: false,
    });

    await startStudySession(flags);
    await submitStudyReview(
      { cardId: '123e4567-e89b-42d3-a456-426614174000', grade: 'good' },
      undefined,
      flags
    );
    await undoStudyReview('review-log-1', undefined, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/api/study/session/start`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/api/study/reviews`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/study/reviews/undo`,
      expect.any(Object)
    );
  });

  it('undoes study reviews with device timezone and current overview', async () => {
    await undoStudyReview('review-log-1', {
      dueCount: 1,
      newCount: 0,
      learningCount: 0,
      reviewCount: 1,
      suspendedCount: 0,
      totalCards: 1,
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/reviews/undo`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      reviewLogId: 'review-log-1',
      currentOverview: expect.objectContaining({
        dueCount: 1,
        reviewCount: 1,
      }),
      timeZone: expect.any(String),
    });
  });

  it('requests answer-audio regeneration with selected voice settings', async () => {
    await regenerateStudyAnswerAudio({
      cardId: 'card-1',
      answerAudioVoiceId: 'ja-JP-Neural2-C',
      answerAudioTextOverride: 'かいしゃ',
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/cards/card-1/regenerate-answer-audio`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      answerAudioVoiceId: 'ja-JP-Neural2-C',
      answerAudioTextOverride: 'かいしゃ',
    });
  });

  it('routes answer-audio preparation and regeneration together when card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: true,
    });

    await prepareStudyAnswerAudio('card-1', flags);
    await regenerateStudyAnswerAudio(
      {
        cardId: 'card-1',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
      },
      flags
    );

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/learning-os/study/cards/card-1/prepare-answer-audio`,
      `${API_URL}/api/learning-os/study/cards/card-1/regenerate-answer-audio`,
    ]);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      answerAudioVoiceId: 'ja-JP-Neural2-C',
      answerAudioTextOverride: 'かいしゃ',
    });
    fetchMock.mock.calls.forEach(([, requestInit]) => {
      const headers = new Headers((requestInit as RequestInit).headers);
      expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    });
  });

  it('keeps answer-audio operations on Convo Lab until card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: false,
    });

    await prepareStudyAnswerAudio('card-1', flags);
    await regenerateStudyAnswerAudio({ cardId: 'card-1' }, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/study/cards/card-1/prepare-answer-audio`,
      `${API_URL}/api/study/cards/card-1/regenerate-answer-audio`,
    ]);
  });

  it('routes card-image regeneration through Learning OS when card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: true,
    });

    await regenerateStudyCardImage(
      {
        cardId: 'card-1',
        imagePrompt: 'A company office in Tokyo.',
        imageRole: 'answer',
      },
      flags
    );

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/cards/card-1/regenerate-image`,
      expect.any(Object)
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      imagePrompt: 'A company office in Tokyo.',
      imageRole: 'answer',
    });
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('keeps card-image regeneration on Convo Lab until card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: false,
    });

    await regenerateStudyCardImage(
      {
        cardId: 'card-1',
        imagePrompt: 'A company office in Tokyo.',
        imageRole: 'answer',
      },
      flags
    );

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/cards/card-1/regenerate-image`,
      expect.any(Object)
    );
  });

  it('requests study-card pitch accent resolution with CSRF headers', async () => {
    await resolveStudyCardPitchAccent('card-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/cards/card-1/pitch-accent`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBeNull();
    expect(requestInit.method).toBe('POST');
  });

  it('routes pitch-accent resolution through Learning OS when card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: true,
    });

    await resolveStudyCardPitchAccent('card-1', flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/cards/card-1/pitch-accent`,
      expect.any(Object)
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toBeUndefined();
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('keeps pitch-accent resolution on Convo Lab until card writes are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: false,
    });

    await resolveStudyCardPitchAccent('card-1', flags);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/cards/card-1/pitch-accent`,
      expect.any(Object)
    );
  });

  it('deletes study cards with CSRF headers', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as Response);

    await deleteStudyCard('card-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/cards/card-1`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBeNull();
    expect(requestInit.method).toBe('DELETE');
  });

  it('routes idempotent card writes together when the child flag is enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: true,
    });
    vi.mocked(global.fetch)
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return {
          ok: true,
          json: async () => ({ id: body.id }),
        } as Response;
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ card: { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }, overview: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response);

    const prompt = { cueText: '会社' };
    const answer = { meaning: 'company' };
    const id = createStudyCardId();
    const created = await createStudyCard({ id, cardType: 'recognition', prompt, answer }, flags);
    const cardId = created.id;
    await updateStudyCard({ cardId, prompt, answer }, flags);
    await performStudyCardAction({ cardId, action: 'suspend' }, flags);
    await deleteStudyCard(cardId, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/learning-os/study/cards`,
      `${API_URL}/api/learning-os/study/cards/${cardId}`,
      `${API_URL}/api/learning-os/study/cards/${cardId}/actions`,
      `${API_URL}/api/learning-os/study/cards/${cardId}`,
    ]);
    const createBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(createBody).toMatchObject({ cardType: 'recognition', prompt, answer });
    expect(createBody.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(createBody.id).toBe(id);
    expect(createBody.id).toBe(cardId);
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('reuses a caller-owned card ID when the same create is retried', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: true,
    });
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
      } as Response);
    const payload = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      cardType: 'recognition' as const,
      prompt: { cueText: '会社' },
      answer: { meaning: 'company' },
    };

    await expect(createStudyCard(payload, flags)).rejects.toThrow('Network request failed');
    await createStudyCard(payload, flags);

    const requestIds = vi
      .mocked(global.fetch)
      .mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).id);
    expect(requestIds).toEqual([payload.id, payload.id]);
  });

  it('keeps all card writes on Convo Lab until the child flag is enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardWrites: false,
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({ id: 'card-1', card: { id: 'card-1' }, overview: {} }),
    } as Response);

    const prompt = { cueText: '会社' };
    const answer = { meaning: 'company' };
    await createStudyCard(
      { id: createStudyCardId(), cardType: 'recognition', prompt, answer },
      flags
    );
    await updateStudyCard({ cardId: 'card-1', prompt, answer }, flags);
    await performStudyCardAction({ cardId: 'card-1', action: 'suspend' }, flags);
    await deleteStudyCard('card-1', flags);

    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/study/cards`,
      `${API_URL}/api/study/cards/card-1`,
      `${API_URL}/api/study/cards/card-1/actions`,
      `${API_URL}/api/study/cards/card-1`,
    ]);
  });

  it('routes the durable manual-card draft lifecycle together when enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: true,
    });
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ drafts: [], total: 0, limit: 200, nextCursor: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: draftId }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: draftId }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: draftId, status: 'generating' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ card: { id: cardId }, draftId }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response);

    const createPayload = {
      creationKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: '会社' },
      answer: { meaning: 'company' },
      imagePlacement: 'none' as const,
    };
    await getStudyManualCardDrafts({ limit: 200 }, flags);
    await createStudyManualCardDraft(createPayload, flags);
    await updateStudyManualCardDraft(
      {
        draftId,
        values: {
          prompt: createPayload.prompt,
          answer: { meaning: 'business' },
        },
      },
      flags
    );
    await retryStudyManualCardDraft(draftId, flags);
    await createCardFromStudyManualCardDraft(draftId, cardId, flags);
    await deleteStudyManualCardDraft(draftId, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/learning-os/study/card-drafts?limit=200`,
      `${API_URL}/api/learning-os/study/card-drafts`,
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}`,
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}/retry`,
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}/create-card`,
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}`,
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[4]?.[1] as RequestInit).body))).toEqual({
      id: cardId,
    });
    expect((fetchMock.mock.calls[5]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('routes draft preview media generation with the card-drafts flag and no body', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: true,
    });
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          previewAudio: { id: 'audio-1' },
          previewAudioRole: 'answer',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagePrompt: 'Office',
          imagePlacement: 'prompt',
          previewImage: { id: 'image-1' },
        }),
      } as Response);

    await generateStudyManualCardDraftPreviewAudio(
      {
        draftId,
        legacyRequest: {
          candidate: {
            clientId: 'candidate-1',
            candidateKind: 'text-recognition',
            cardType: 'recognition',
            prompt: { cueText: '会社' },
            answer: { meaning: 'company' },
          },
        },
      },
      flags
    );
    await generateStudyManualCardDraftPreviewImage(
      {
        draftId,
        legacyRequest: { imagePrompt: 'Office', imagePlacement: 'prompt' },
      },
      flags
    );

    const { calls } = vi.mocked(global.fetch).mock;
    expect(calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}/preview-audio`,
      `${API_URL}/api/learning-os/study/card-drafts/${draftId}/preview-image`,
    ]);
    expect(calls.map(([, init]) => init)).toEqual([
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    ]);
    expect(
      calls.every(([, init]) => !Object.prototype.hasOwnProperty.call(init as object, 'body'))
    ).toBe(true);
  });

  it('keeps draft preview media on Convo Lab until card drafts are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: false,
    });
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

    const candidate = {
      clientId: 'candidate-1',
      candidateKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: '会社' },
      answer: { meaning: 'company' },
    };
    await generateStudyManualCardDraftPreviewAudio(
      { draftId, legacyRequest: { candidate } },
      flags
    );
    await generateStudyManualCardDraftPreviewImage(
      {
        draftId,
        legacyRequest: { imagePrompt: 'Office', imagePlacement: 'prompt' },
      },
      flags
    );

    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/study/card-candidates/regenerate-audio`,
      `${API_URL}/api/study/cards/draft/image`,
    ]);
  });

  it('routes vocab bundle draft creation with the manual-card draft feature', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: true,
    });
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        groupId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        drafts: [],
      }),
    } as Response);

    await createStudyVocabBundleDrafts(
      {
        targetWord: '会社',
        sourceSentence: '会社で働きます。',
        context: 'work',
        includeLearnerContext: false,
      },
      flags
    );

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/card-candidates/vocab-bundle/drafts`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('keeps vocab bundle draft creation on Convo Lab until card drafts are enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: false,
    });

    await createStudyVocabBundleDrafts({ targetWord: '会社' }, flags);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-candidates/vocab-bundle/drafts`,
      expect.any(Object)
    );
  });

  it('notifies the app when a Study request finds an expired session', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Authentication required' } }),
    } as Response);

    await expect(getStudySettings()).rejects.toThrow('Authentication required');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
  });

  it('keeps the session when a Study request returns a gateway error', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: { message: 'Learning OS Study API request failed.' } }),
    } as Response);

    await expect(getStudySettings()).rejects.toThrow('Learning OS Study API request failed.');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
  });

  it('keeps manual-card drafts on Convo Lab until their child flag is enabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiCardDrafts: false,
    });
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ drafts: [], total: 0, limit: 200, nextCursor: null }),
    } as Response);

    await getStudyManualCardDrafts({ limit: 200 }, flags);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-drafts?limit=200`,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('passes browser sort params to the study API', async () => {
    await getStudyBrowser({
      sortField: 'created_on',
      sortDirection: 'desc',
      limit: 25,
    });

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/browser?sortField=created_on&sortDirection=desc&limit=25`,
      expect.any(Object)
    );
  });

  it('uses the existing Convo Lab study API when the parent Study API flag is off', async () => {
    await getStudySettings(
      featureFlags({
        studyApiEnabled: false,
        studyApiSettings: true,
      })
    );

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/settings`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.credentials).toBe('include');
    expect(new Headers(requestInit.headers).has('Authorization')).toBe(false);
  });

  it('keeps endpoint-specific study reads on Convo Lab until their child flag is enabled', async () => {
    await getStudyBrowser(
      { limit: 10 },
      featureFlags({
        studyApiEnabled: true,
        studyApiBrowser: false,
      })
    );

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/browser?limit=10`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.credentials).toBe('include');
    expect(new Headers(requestInit.headers).has('Authorization')).toBe(false);
  });

  it('routes browser note detail independently from the browser list', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiBrowser: false,
      studyApiBrowserDetail: true,
    });

    await getStudyBrowserNoteDetail('note/with spaces', flags);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/browser/note%2Fwith%20spaces`,
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('keeps browser note detail on Convo Lab while its flag is disabled', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiBrowser: true,
      studyApiBrowserDetail: false,
    });

    await getStudyBrowserNoteDetail('note-1', flags);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/browser/note-1`,
      expect.any(Object)
    );
  });

  it('routes enabled read-only study endpoints through the Convo Lab proxy', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiSettings: true,
      studyApiNewQueue: true,
      studyApiBrowser: true,
      studyApiImports: true,
    });

    await getStudySettings(flags);
    await getStudyNewCardQueue({ cursor: 'cursor-1', q: '  kana  ' }, flags);
    await getStudyBrowser({ sortField: 'created_on', sortDirection: 'desc', limit: 25 }, flags);
    await getCurrentStudyImport(undefined, flags);
    await getStudyImportStatus('import-1', undefined, flags);
    await getStudyImportUploadReadiness(flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/api/learning-os/study/settings`,
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/api/learning-os/study/new-queue?cursor=cursor-1&q=kana`,
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/learning-os/study/browser?sortField=created_on&sortDirection=desc&limit=25`,
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `${API_URL}/api/learning-os/study/imports/current`,
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `${API_URL}/api/learning-os/study/imports/import-1`,
      expect.objectContaining({ credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `${API_URL}/api/learning-os/study/imports/readiness`,
      expect.objectContaining({ credentials: 'include' })
    );

    fetchMock.mock.calls.forEach(([, requestInit]) => {
      const headers = new Headers((requestInit as RequestInit).headers);
      expect(headers.has('Authorization')).toBe(false);
      expect(headers.get('Accept')).toBe('application/json');
      expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
    });
  });

  it('routes settings writes independently with JSON and CSRF headers', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiSettings: true,
      studyApiSettingsWrite: true,
    });

    await updateStudySettings({ newCardsPerDay: 23 }, flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/settings`,
      expect.any(Object)
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(requestInit.method).toBe('PATCH');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(JSON.parse(String(requestInit.body))).toEqual({ newCardsPerDay: 23 });
  });

  it('keeps settings writes on Convo Lab until the write flag is enabled', async () => {
    await updateStudySettings(
      { newCardsPerDay: 23 },
      featureFlags({
        studyApiEnabled: true,
        studyApiSettings: true,
        studyApiSettingsWrite: false,
      })
    );

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/settings`,
      expect.any(Object)
    );
  });

  it('keeps settings writes on Convo Lab when the matching read flag is off', async () => {
    await updateStudySettings(
      { newCardsPerDay: 23 },
      featureFlags({
        studyApiEnabled: true,
        studyApiSettings: false,
        studyApiSettingsWrite: true,
      })
    );

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_URL}/api/study/settings`,
      expect.any(Object)
    );
  });

  it('routes New Queue reorders independently with JSON and CSRF headers', async () => {
    const flags = featureFlags({
      studyApiEnabled: true,
      studyApiNewQueue: true,
      studyApiNewQueueWrite: true,
    });

    await reorderStudyNewCardQueue(['01ARZ3NDEKTSV4RRFFQ69G5FAV'], flags);

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/learning-os/study/new-queue/reorder`,
      expect.any(Object)
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(requestInit.method).toBe('POST');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      cardIds: ['01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    });
  });

  it('generates study card candidates with JSON and CSRF headers', async () => {
    await generateStudyCardCandidates({
      targetText: '会社',
      context: 'Business word',
      includeLearnerContext: true,
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-candidates/generate`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      targetText: '会社',
      context: 'Business word',
      includeLearnerContext: true,
    });
  });

  it('commits selected generated candidates to the study API', async () => {
    await commitStudyCardCandidates({
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          prompt: {
            cueAudio: {
              id: 'media-1',
              filename: 'candidate-1.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answer: { expression: '会社', meaning: 'company' },
          previewAudio: {
            id: 'media-1',
            filename: 'candidate-1.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'prompt',
        },
      ],
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-candidates/commit`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      candidates: [
        expect.objectContaining({
          candidateKind: 'audio-recognition',
          previewAudioRole: 'prompt',
        }),
      ],
    });
  });

  it('regenerates candidate preview audio with JSON and CSRF headers', async () => {
    await regenerateStudyCardCandidatePreviewAudio({
      candidate: {
        clientId: 'candidate-1',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: 'company' },
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'ja-JP-Neural2-C',
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-candidates/regenerate-audio`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      candidate: expect.objectContaining({
        candidateKind: 'production',
        previewAudio: null,
      }),
    });
  });

  it('regenerates candidate preview images with JSON and CSRF headers', async () => {
    await regenerateStudyCardCandidatePreviewImage({
      imagePrompt: 'A simple cloudy weather image.',
      candidate: {
        clientId: 'candidate-1',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
        previewAudio: null,
        previewAudioRole: null,
        imagePrompt: 'A simple cloudy weather image.',
        previewImage: null,
      },
    });

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/card-candidates/regenerate-image`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      imagePrompt: 'A simple cloudy weather image.',
      candidate: expect.objectContaining({
        candidateKind: 'production',
        imagePrompt: 'A simple cloudy weather image.',
      }),
    });
  });

  it('attaches the shared CSRF token header to import uploads', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          importJob: {
            id: 'import-1',
            status: 'pending',
            sourceFilename: 'japanese.colpkg',
            deckName: '日本語',
            uploadedAt: null,
            sourceSizeBytes: null,
            importedAt: null,
            errorMessage: null,
            preview: {
              deckName: '日本語',
              noteCount: 0,
              cardCount: 0,
              reviewLogCount: 0,
              mediaReferenceCount: 0,
              skippedMediaCount: 0,
              warnings: [],
              noteTypeBreakdown: [],
            },
          },
          upload: {
            method: 'PUT',
            url: 'https://uploads.example/import-1',
            headers: {
              'Content-Type': 'application/zip',
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'import-1',
          status: 'pending',
          sourceFilename: 'japanese.colpkg',
          deckName: '日本語',
          uploadedAt: new Date('2026-04-23T00:00:00.000Z').toISOString(),
          sourceSizeBytes: 3,
          importedAt: null,
          errorMessage: null,
          preview: {
            deckName: '日本語',
            noteCount: 0,
            cardCount: 0,
            reviewLogCount: 0,
            mediaReferenceCount: 0,
            skippedMediaCount: 0,
            warnings: [],
            noteTypeBreakdown: [],
          },
        }),
      } as Response);

    await uploadStudyImport(new File(['zip'], 'japanese.colpkg'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/imports`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(MockXMLHttpRequest.lastInstance?.method).toBe('PUT');
    expect(MockXMLHttpRequest.lastInstance?.url).toBe('https://uploads.example/import-1');
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get('Content-Type')).toBe(
      'application/zip'
    );
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
  });

  it('routes the complete import lifecycle through Learning OS atomically', async () => {
    const flags = featureFlags({ studyApiEnabled: true, studyApiImports: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          importJob: {
            id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
            status: 'pending',
            sourceFilename: 'japanese.colpkg',
            deckName: 'Japanese',
            uploadedAt: null,
            uploadExpiresAt: '2099-04-21T01:00:00.000Z',
            sourceSizeBytes: null,
            importedAt: null,
            errorMessage: null,
            preview: {
              deckName: 'Japanese',
              noteCount: 0,
              cardCount: 0,
              reviewLogCount: 0,
              mediaReferenceCount: 0,
              skippedMediaCount: 0,
              warnings: [],
              noteTypeBreakdown: [],
            },
          },
          upload: {
            method: 'PUT',
            url: '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
            headers: { 'Content-Type': 'application/zip' },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'pending' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'failed' }) } as Response);

    await uploadStudyImport(
      new File(['zip'], 'japanese.colpkg', { type: 'application/zip' }),
      flags
    );
    await cancelStudyImportUpload('01ARZ3NDEKTSV4RRFFQ69G5FAW', flags);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/api/learning-os/study/imports`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/complete`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/cancel`,
      expect.any(Object)
    );
    expect(MockXMLHttpRequest.lastInstance?.url).toBe(
      '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload'
    );
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
    fetchMock.mock.calls.forEach(([, requestInit]) => {
      const headers = new Headers((requestInit as RequestInit).headers);
      expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    });
  });

  it('does not attach mutation-only headers to study import status reads', async () => {
    await getStudyImportStatus('import-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
    expect(headers.has('Content-Type')).toBe(false);
  });
});
