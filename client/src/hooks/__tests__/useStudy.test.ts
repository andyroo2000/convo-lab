import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import type { FeatureFlags } from '../useFeatureFlags';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME } from '../../lib/csrf';
import {
  commitStudyCardCandidates,
  deleteStudyCard,
  getCurrentStudyImport,
  getStudyNewCardQueue,
  getStudySettings,
  generateStudyCardCandidates,
  getStudyBrowser,
  getStudyImportStatus,
  regenerateStudyCardCandidatePreviewAudio,
  regenerateStudyCardCandidatePreviewImage,
  regenerateStudyAnswerAudio,
  reorderStudyNewCardQueue,
  resolveStudyCardPitchAccent,
  startStudySession,
  undoStudyReview,
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
    studyApiNewQueue: false,
    studyApiImports: false,
    studyApiSettingsWrite: false,
    studyApiNewQueueWrite: false,
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
