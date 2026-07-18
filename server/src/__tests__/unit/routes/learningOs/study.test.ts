import cookieParser from 'cookie-parser';
import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { sign as signJwt } from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfErrorHandler,
  issueCsrfTokenCookie,
  requireApiCsrfProtection,
} from '../../../../middleware/csrf.js';
import { resetBrowserRuntimeTestState } from '../../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray } from '../../../helpers/testCookieParser.js';

const mockPrisma = vi.hoisted(() => ({
  featureFlag: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));
const invokedRateLimitKeys = vi.hoisted(() => [] as string[]);

const mockRateLimitStudyRoute = vi.hoisted(() =>
  vi.fn((options: { key: string }) => (_req: Request, _res: Response, next: NextFunction) => {
    invokedRateLimitKeys.push(options.key);
    next();
  })
);

vi.mock('../../../../db/client.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: mockRateLimitStudyRoute,
}));

describe('Learning OS Study proxy routes', () => {
  const originalLearningOsApiUrl = process.env.LEARNING_OS_API_URL;
  const originalLearningOsApiToken = process.env.LEARNING_OS_API_TOKEN;
  const originalLearningOsProxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalClientUrl = process.env.CLIENT_URL;

  const emptyBrowserResponse = {
    rows: [],
    total: 0,
    limit: 50,
    nextCursor: null,
    filterOptions: { noteTypes: [], cardTypes: [], queueStates: [] },
  };

  const browserDetailResponse = {
    noteId: 'note-1',
    displayText: '会社',
    noteTypeName: 'Japanese - Vocab',
    sourceKind: 'anki_import',
    updatedAt: '2026-07-15T12:00:00.000000Z',
    rawFields: [],
    canonicalFields: [],
    cards: [],
    cardStats: [],
    selectedCardId: null,
  };

  const emptyOverviewResponse = {
    data: {
      due_count: 0,
      failed_count: 0,
      new_count: 0,
      new_cards_per_day: 20,
      new_cards_introduced_today: 0,
      new_cards_available_today: 0,
      learning_count: 0,
      review_count: 0,
      suspended_count: 0,
      total_cards: 0,
      latest_import: null,
      next_due_at: null,
    },
  };

  const importJobResource = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    status: 'pending',
    source_type: 'anki_colpkg',
    source_filename: 'japanese.colpkg',
    source_content_type: 'application/zip',
    source_size_bytes: null,
    deck_name: 'Japanese',
    preview: null,
    summary: null,
    error_message: null,
    started_at: null,
    uploaded_at: null,
    upload_completed_at: null,
    upload_expires_at: '2026-07-16T13:00:00.000000Z',
    completed_at: null,
    created_at: '2026-07-16T12:00:00.000000Z',
    updated_at: '2026-07-16T12:00:00.000000Z',
  };

  const newQueueResponse = {
    items: [
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition',
        displayText: '会社',
        meaning: 'company',
        queuePosition: 2,
        createdAt: '2026-07-15T12:00:00.000000Z',
        updatedAt: '2026-07-15T13:00:00.000000Z',
      },
    ],
    total: 1,
    limit: 25,
    nextCursor: null,
  };

  const compatibilityOverview = {
    dueCount: 1,
    failedCount: 0,
    newCount: 2,
    newCardsPerDay: 20,
    newCardsIntroducedToday: 1,
    newCardsAvailableToday: 1,
    learningCount: 0,
    reviewCount: 1,
    suspendedCount: 0,
    totalCards: 3,
    latestImport: {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      status: 'completed',
      sourceFilename: 'core.colpkg',
      deckName: 'Core',
      preview: null,
      uploadedAt: '2026-07-15T10:00:00.000000Z',
      uploadExpiresAt: null,
      sourceSizeBytes: 1234,
      completedAt: '2026-07-15T12:00:00.000000Z',
      errorMessage: null,
    },
    nextDueAt: '2026-07-17T12:00:00.000000Z',
  };

  const compatibilityCard = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    noteId: '123e4567-e89b-42d3-a456-426614174001',
    cardType: 'recognition',
    prompt: { cueText: '会社' },
    answer: {
      meaning: 'company',
      answerAudioVoiceId: null,
      answerAudioTextOverride: null,
    },
    state: {
      dueAt: '2026-07-16T12:00:00.000000Z',
      introducedAt: '2026-07-10T12:00:00.000000Z',
      failedAt: null,
      queueState: 'review',
      scheduler: { state: 2, reps: 4 },
      source: {
        noteId: '501',
        noteGuid: 'guid-501',
        cardId: '701',
        deckId: '301',
        deckName: '日本語',
        notetypeId: '601',
        notetypeName: 'Japanese - Vocab',
        templateOrd: 0,
        templateName: 'Card 1',
        queue: 2,
        type: 2,
        due: 12,
        ivl: 30,
        factor: 2500,
        reps: 4,
        lapses: 0,
        left: 0,
        odue: 0,
        odid: null,
      },
      rawFsrs: { stability: 4.2 },
    },
    variantGroupId: null,
    variantSentenceId: null,
    variantKind: null,
    variantStage: null,
    variantStatus: null,
    variantUnlockedAt: null,
    answerAudioSource: 'missing',
    createdAt: '2026-07-01T12:00:00.000000Z',
    updatedAt: '2026-07-16T12:00:00.000000Z',
  };
  const compatibilityCardDraft = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
    status: 'ready',
    creationKind: 'text-recognition',
    cardType: 'recognition',
    prompt: { cueText: '会社' },
    answer: { meaning: 'company' },
    imagePlacement: 'none',
    imagePrompt: null,
    previewAudio: null,
    previewAudioRole: null,
    previewImage: null,
    variantGroupId: null,
    variantSentenceId: null,
    variantKind: null,
    variantStage: null,
    variantStatus: null,
    variantUnlockedAt: null,
    errorMessage: null,
    committedCardId: null,
    createdAt: '2026-07-18T12:00:00.000000Z',
    updatedAt: '2026-07-18T12:00:00.000000Z',
  };
  const compatibilityVocabBundleDrafts = (groupId: string) =>
    [
      ...Array.from({ length: 3 }, () => ({
        stage: 1,
        kind: 'sentence_audio_recognition',
        status: 'available',
        sentenceId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      })),
      ...Array.from({ length: 3 }, () => ({
        stage: 2,
        kind: 'sentence_text_recognition',
        status: 'locked',
        sentenceId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      })),
      {
        stage: 3,
        kind: 'word_audio_recognition',
        status: 'locked',
        sentenceId: null,
      },
      {
        stage: 4,
        kind: 'word_text_recognition',
        status: 'locked',
        sentenceId: null,
      },
      ...Array.from({ length: 3 }, () => ({
        stage: 5,
        kind: 'sentence_cloze',
        status: 'locked',
        sentenceId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      })),
    ].map(({ stage, kind, status, sentenceId }) => ({
      ...compatibilityCardDraft,
      status: 'generating',
      variantGroupId: groupId,
      variantSentenceId: sentenceId,
      variantKind: kind,
      variantStage: stage,
      variantStatus: status,
      variantUnlockedAt: stage === 1 ? '2026-07-18T12:00:00.000000Z' : null,
    }));

  function createApp() {
    const app = express();
    app.set('query parser', 'extended');
    app.use(cookieParser());
    app.use(expressJson());
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.sendStatus(204);
    });
    app.use('/api/learning-os/study', requireApiCsrfProtection);

    return import('../../../../routes/learningOs/study.js').then(
      ({ default: learningOsStudyRoutes }) => {
        app.use('/api/learning-os/study', learningOsStudyRoutes);
        app.use(apiCsrfErrorHandler);
        app.use(((error: unknown, _req, res, _next) => {
          const appError = error as { statusCode?: number; message?: string };
          res.status(appError.statusCode ?? 500).json({
            error: { message: appError.message ?? 'Unexpected error' },
          });
        }) as ErrorRequestHandler);
        return app;
      }
    );
  }

  function authCookie(userId = 'user-1'): string {
    const token = signJwt({ userId, role: 'user' }, process.env.JWT_SECRET as string);
    return `token=${token}`;
  }

  async function csrfAuth(app: express.Application, userId = 'user-1') {
    const auth = authCookie(userId);
    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', auth);
    const cookies = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = cookies
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    const token = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';

    return { cookies: [auth, ...cookies], token };
  }

  const enabledStudyApiFlags = {
    dialoguesEnabled: true,
    scriptsEnabled: true,
    audioCourseEnabled: true,
    flashcardsEnabled: true,
    studyApiEnabled: true,
    studyApiSettings: true,
    studyApiOverview: true,
    studyApiBrowser: true,
    studyApiBrowserDetail: true,
    studyApiNewQueue: true,
    studyApiImports: true,
    studyApiSettingsWrite: true,
    studyApiNewQueueWrite: true,
    studyApiReview: true,
    studyApiCardWrites: true,
    studyApiCardDrafts: true,
    studyApiMedia: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    invokedRateLimitKeys.length = 0;
    vi.useRealTimers();
    const { resetFeatureFlagCacheForTests } =
      await import('../../../../middleware/featureFlags.js');
    resetFeatureFlagCacheForTests();
    process.env.JWT_SECRET = 'test-secret';
    process.env.CLIENT_URL = 'http://localhost:5173';
    resetBrowserRuntimeTestState();
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    process.env.LEARNING_OS_PROXY_USER_EMAIL = 'learner@example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyBrowserResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'learner@example.com',
      role: 'user',
    });
    mockPrisma.featureFlag.findFirst.mockResolvedValue(enabledStudyApiFlags);
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.LEARNING_OS_PROXY_USER_EMAIL = originalLearningOsProxyUserEmail;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.CLIENT_URL = originalClientUrl;
    resetBrowserRuntimeTestState();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('proxies allowed study reads with server-side auth and user identity headers', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser?sortField=created_on&limit=25')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/browser?sortField=created_on&limit=25'
    );
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer server-only-token',
      'X-Convo-Lab-User-Id': 'user-1',
      'X-Convo-Lab-User-Email': 'learner@example.com',
      'X-Convo-Lab-User-Role': 'user',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-read-proxy',
      max: 240,
      windowMs: 60 * 1000,
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-media-proxy',
      max: 600,
      windowMs: 60 * 1000,
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-import-proxy',
      max: 240,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-settings-write-proxy',
      max: 60,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-new-queue-write-proxy',
      max: 60,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-session-start-proxy',
      max: 30,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-review-write-proxy',
      max: 120,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-card-create-proxy',
      max: 120,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-card-update-proxy',
      max: 120,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-card-delete-proxy',
      max: 60,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
      key: 'learning-os-card-action-proxy',
      max: 120,
      windowMs: 60 * 1000,
      onBackendError: 'fail-closed',
    });
    for (const [key, max] of [
      ['learning-os-vocab-bundle-draft-create-proxy', 20],
      ['learning-os-card-draft-create-proxy', 60],
      ['learning-os-card-draft-update-proxy', 120],
      ['learning-os-card-draft-retry-proxy', 30],
      ['learning-os-card-draft-commit-proxy', 60],
      ['learning-os-card-draft-delete-proxy', 60],
    ] as const) {
      expect(mockRateLimitStudyRoute).toHaveBeenCalledWith({
        key,
        max,
        windowMs: 60 * 1000,
        onBackendError: 'fail-closed',
      });
    }
  });

  it('streams Learning OS-owned media with safe response headers', async () => {
    const mediaId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(Uint8Array.from([0, 1, 2, 255]), {
          status: 206,
          headers: {
            'cache-control': 'private, max-age=15552000, immutable',
            'content-disposition': 'inline; filename=word.mp3',
            'content-length': '4',
            'content-range': 'bytes 0-3/100',
            'content-type': 'audio/mpeg',
            etag: '"media-etag"',
            'last-modified': 'Sat, 18 Jul 2026 12:00:00 GMT',
            'set-cookie': 'upstream=must-not-leak',
          },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get(`/api/learning-os/study/media/${mediaId}`)
      .set('Cookie', authCookie())
      .set('Accept', 'audio/mpeg')
      .set('Range', 'bytes=0-3')
      .buffer(true);

    expect(response.status).toBe(206);
    expect(response.body).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(response.headers['content-type']).toBe('audio/mpeg');
    expect(response.headers['content-length']).toBe('4');
    expect(response.headers['content-range']).toBe('bytes 0-3/100');
    expect(response.headers['content-disposition']).toBe('inline; filename=word.mp3');
    expect(response.headers['cache-control']).toBe('private, max-age=15552000, immutable');
    expect(response.headers.etag).toBe('"media-etag"');
    expect(response.headers['last-modified']).toBe('Sat, 18 Jul 2026 12:00:00 GMT');
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['set-cookie']).toBeUndefined();

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`https://learning-os.example/api/study/media/${mediaId}`);
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'audio/mpeg',
        Authorization: 'Bearer server-only-token',
        Range: 'bytes=0-3',
        'X-Convo-Lab-User-Id': 'user-1',
        'X-Convo-Lab-User-Email': 'learner@example.com',
        'X-Convo-Lab-User-Role': 'user',
      },
    });
    expect(invokedRateLimitKeys).toEqual(['learning-os-media-proxy']);
  });

  it.each(['items=0-1', 'bytes=-', 'bytes=0-1,4-5'])(
    'rejects malformed media byte range %s before forwarding',
    async (range) => {
      const app = await createApp();

      const response = await request(app)
        .get('/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAV')
        .set('Cookie', authCookie())
        .set('Range', range);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Invalid Study media byte range.');
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('fails closed for invalid media headers and a disabled media flag', async () => {
    const fetchMock = vi.fn();
    for (const contentType of ['text/html', 'image/svg+xml']) {
      fetchMock.mockResolvedValueOnce(
        new Response('<script>alert(1)</script>', {
          status: 200,
          headers: { 'content-type': contentType },
        })
      );
    }
    vi.stubGlobal('fetch', fetchMock);
    const app = await createApp();

    for (const mediaId of ['01ARZ3NDEKTSV4RRFFQ69G5FAV', '01ARZ3NDEKTSV4RRFFQ69G5FAX']) {
      const invalidHeaders = await request(app)
        .get(`/api/learning-os/study/media/${mediaId}`)
        .set('Cookie', authCookie());

      expect(invalidHeaders.status).toBe(502);
      expect(invalidHeaders.body.error.message).toBe(
        'Learning OS Study API returned invalid media headers.'
      );
    }

    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiMedia: false,
    });
    const { resetFeatureFlagCacheForTests } =
      await import('../../../../middleware/featureFlags.js');
    resetFeatureFlagCacheForTests();

    const disabled = await request(app)
      .get('/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW')
      .set('Cookie', authCookie());

    expect(disabled.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('proxies Browser detail through its independent flag without query parameters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(browserDetailResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...browserDetailResponse,
      updatedAt: '2026-07-15T12:00:00.000Z',
    });
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/browser/note-1');
  });

  it('keeps Browser detail disabled independently from Browser list', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiBrowser: true,
      studyApiBrowserDetail: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the existing Browser detail card note id contract strict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...browserDetailResponse,
            cards: [{ ...compatibilityCard, noteId: null }],
          }),
          { status: 200 }
        )
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid browserDetail response.'
    );
  });

  it('rejects Browser detail query parameters before calling Learning OS', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser/note-1?limit=1')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('serializes successful upstream responses as JSON instead of forwarding content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyOverviewResponse), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      dueCount: 0,
      failedCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 0,
      newCardsAvailableToday: 0,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 0,
      latestImport: null,
      nextDueAt: null,
    });
  });

  it('translates the ConvoLab overview timezone query to the Laravel contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyOverviewResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview?timeZone=America%2FNew_York')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/overview?time_zone=America%2FNew_York'
    );
  });

  it('adapts Laravel study settings to the existing ConvoLab response contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              new_cards_per_day: 17,
              created_at: '2026-07-15T12:00:00.000000Z',
              updated_at: '2026-07-15T12:00:00.000000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ newCardsPerDay: 17 });
  });

  it('proxies settings writes with CSRF protection and the Laravel request contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { new_cards_per_day: 23 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ newCardsPerDay: 23 });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/settings');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ new_cards_per_day: 23 });
  });

  it('starts Learning OS study sessions and adapts the Laravel resource envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              overview: emptyOverviewResponse.data,
              cards: [{ ...compatibilityCard, noteId: null }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/session/start')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ timeZone: ' America/New_York ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      overview: {
        dueCount: 0,
        failedCount: 0,
        newCount: 0,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 0,
        newCardsAvailableToday: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 0,
        latestImport: null,
        nextDueAt: null,
      },
      cards: [expect.objectContaining({ id: compatibilityCard.id, noteId: null })],
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/session/start');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ time_zone: 'America/New_York' });
  });

  it('validates and proxies review grades with bounded duration and compatibility responses', async () => {
    const lowercaseCardUlid = '01arz3ndektsv4rrffq69g5fax';
    const reviewResponse = {
      reviewLogId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      card: compatibilityCard,
      overview: compatibilityOverview,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(reviewResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/reviews')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        cardId: lowercaseCardUlid,
        grade: 'good',
        durationMs: 9_000_000,
        timeZone: 'America/New_York',
        currentOverview: compatibilityOverview,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        reviewLogId: reviewResponse.reviewLogId,
        card: expect.objectContaining({ id: compatibilityCard.id }),
        overview: expect.objectContaining({
          reviewCount: 1,
          nextDueAt: '2026-07-17T12:00:00.000Z',
        }),
      })
    );
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/reviews');
    expect(JSON.parse(String(init.body))).toEqual({
      cardId: lowercaseCardUlid.toUpperCase(),
      grade: 'good',
      durationMs: 3_600_000,
      timeZone: 'America/New_York',
      currentOverview: compatibilityOverview,
    });
  });

  it('rejects malformed review overview imports instead of passing them to the client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            reviewLogId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
            card: compatibilityCard,
            overview: {
              ...compatibilityOverview,
              latestImport: { id: 'import-without-required-fields' },
            },
          }),
          { status: 200 }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/reviews')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ cardId: compatibilityCard.id, grade: 'good' });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid review response.'
    );
  });

  it('preserves a committed review whose card refetch lost a race', async () => {
    const committedResponse = {
      message: 'Study card not found after review.',
      reviewLogId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      committed: true,
      cardFetchFailed: true,
      card: null,
      overview: compatibilityOverview,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(committedResponse), { status: 200 }))
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/reviews')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ cardId: compatibilityCard.id, grade: 'good' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        reviewLogId: committedResponse.reviewLogId,
        committed: true,
        cardFetchFailed: true,
        card: null,
      })
    );
  });

  it('normalizes and proxies review undo through the same review flag', async () => {
    const reviewLogId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            reviewLogId,
            card: compatibilityCard,
            overview: compatibilityOverview,
          }),
          { status: 200 }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/reviews/undo')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ reviewLogId: reviewLogId.toLowerCase(), timeZone: 'America/New_York' });

    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/reviews/undo');
    expect(JSON.parse(String(init.body))).toEqual({ reviewLogId, timeZone: 'America/New_York' });
  });

  it.each([
    ['/api/learning-os/study/reviews', { cardId: 'not-a-card', grade: 'good' }],
    ['/api/learning-os/study/reviews', { cardId: compatibilityCard.id, grade: 'perfect' }],
    ['/api/learning-os/study/reviews/undo', { reviewLogId: 'not-a-review' }],
    ['/api/learning-os/study/session/start', { timeZone: 'Not/A_Zone' }],
  ])('rejects invalid review input before calling Learning OS: %s', async (path, body) => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post(path)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send(body);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps all review operations on Convo Lab when the review child flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiReview: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/session/start')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ timeZone: 'America/New_York' });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('proxies idempotent card creates with normalized ULIDs and compatibility payloads', async () => {
    const cardWithLearningOsMedia = {
      ...compatibilityCard,
      prompt: {
        ...compatibilityCard.prompt,
        cueAudio: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          filename: 'word.mp3',
          url: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(cardWithLearningOsMedia), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/cards')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        id: '01arz3ndektsv4rrffq69g5fav',
        creationKind: 'TEXT-RECOGNITION',
        cardType: 'recognition',
        prompt: { text: '会社' },
        answer: { text: 'company' },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ...cardWithLearningOsMedia,
      prompt: {
        ...cardWithLearningOsMedia.prompt,
        cueAudio: {
          ...cardWithLearningOsMedia.prompt.cueAudio,
          url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
        },
      },
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/cards');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: { text: '会社' },
      answer: { text: 'company' },
    });
    expect(invokedRateLimitKeys).toEqual(['learning-os-card-create-proxy']);
  });

  it('proxies card updates, actions, and idempotent deletes through one child flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(compatibilityCard), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ card: compatibilityCard, overview: compatibilityOverview }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const updateResponse = await request(app)
      .patch(`/api/learning-os/study/cards/${compatibilityCard.id}`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ prompt: { text: '会社' }, answer: { text: 'updated company' } });
    const actionResponse = await request(app)
      .post(`/api/learning-os/study/cards/${compatibilityCard.id}/actions`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        action: 'SET_DUE',
        mode: 'TOMORROW',
        timeZone: 'America/New_York',
        currentOverview: compatibilityOverview,
      });
    const deleteResponse = await request(app)
      .delete(`/api/learning-os/study/cards/${compatibilityCard.id}`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token);

    expect(updateResponse.status).toBe(200);
    expect(actionResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(204);
    const calls = vi.mocked(global.fetch).mock.calls as [URL, RequestInit][];
    expect(calls.map(([url]) => url.toString())).toEqual([
      `https://learning-os.example/api/study/cards/${compatibilityCard.id}`,
      `https://learning-os.example/api/study/cards/${compatibilityCard.id}/actions`,
      `https://learning-os.example/api/study/cards/${compatibilityCard.id}`,
    ]);
    expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({
      action: 'set_due',
      mode: 'tomorrow',
      timeZone: 'America/New_York',
      currentOverview: compatibilityOverview,
    });
    expect(calls.map(([, init]) => init.method)).toEqual(['PATCH', 'POST', 'DELETE']);
    expect(invokedRateLimitKeys).toEqual([
      'learning-os-card-update-proxy',
      'learning-os-card-action-proxy',
      'learning-os-card-delete-proxy',
    ]);
  });

  it.each([
    [{ cardType: 'recognition', prompt: {}, answer: {} }],
    [{ id: 'not-a-ulid', cardType: 'recognition', prompt: {}, answer: {} }],
    [{ id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', cardType: 'unknown', prompt: {}, answer: {} }],
    [
      {
        creationKind: 'text-recognition',
        cardType: 'cloze',
        prompt: {},
        answer: {},
      },
    ],
    [{ cardType: 'recognition', prompt: '会社', answer: {} }],
  ])('rejects invalid card create bodies before calling Learning OS', async (body) => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/cards')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send(body);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        nested: {
          nested: { nested: { nested: { nested: { nested: { nested: { nested: {} } } } } } },
        },
      },
      { text: 'company' },
      '8 levels deep or fewer',
    ],
    [{ text: '会社' }, { text: 'x'.repeat(65 * 1024) }, '64 KB or smaller'],
  ])(
    'enforces the shared card payload envelope before calling Learning OS',
    async (prompt, answer, message) => {
      const app = await createApp();
      const { cookies, token } = await csrfAuth(app);

      const response = await request(app)
        .post('/api/learning-os/study/cards')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookies)
        .set(CSRF_TOKEN_HEADER_NAME, token)
        .send({ cardType: 'recognition', prompt, answer });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(message);
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it.each([
    [{ action: 'set_due', mode: 'tomorrow', timeZone: 'Not/A_Zone' }],
    [{ action: 'set_due', mode: 'custom_date', dueAt: 'tomorrow' }],
    [{ action: 'set_due', mode: 'custom_date', dueAt: '2099-01-01T00:00:00Z' }],
    [{ action: 'archive' }],
  ])('rejects invalid card actions before calling Learning OS', async (body) => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post(`/api/learning-os/study/cards/${compatibilityCard.id}/actions`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send(body);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps every card write disabled under the shared child flag', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiCardWrites: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const createResponse = await request(app)
      .post('/api/learning-os/study/cards')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ cardType: 'recognition', prompt: { text: '会社' }, answer: { text: 'company' } });
    const updateResponse = await request(app)
      .patch(`/api/learning-os/study/cards/${compatibilityCard.id}`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ prompt: { text: '会社' }, answer: { text: 'company' } });

    expect(createResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('proxies the complete durable card-draft lifecycle under one child flag', async () => {
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              drafts: [compatibilityCardDraft],
              total: 1,
              limit: 200,
              nextCursor: null,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(compatibilityCardDraft), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(compatibilityCardDraft), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...compatibilityCardDraft, status: 'generating' }), {
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...compatibilityCard, id: cardId }), { status: 201 })
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const draftPath = `/api/learning-os/study/card-drafts/${compatibilityCardDraft.id}`;

    const listResponse = await request(app)
      .get('/api/learning-os/study/card-drafts?limit=200')
      .set('Cookie', authCookie());
    const createResponse = await request(app)
      .post('/api/learning-os/study/card-drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        creationKind: 'TEXT-RECOGNITION',
        cardType: 'RECOGNITION',
        prompt: { cueText: '会社' },
        answer: { meaning: 'company' },
        imagePlacement: 'NONE',
        imagePrompt: '  office building  ',
      });
    const updateResponse = await request(app)
      .patch(draftPath)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        prompt: { cueText: '会社' },
        answer: { meaning: 'business' },
        previewAudio: {
          id: 'audio-1',
          filename: 'company.mp3',
          url: null,
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'ANSWER',
      });
    const retryResponse = await request(app)
      .post(`${draftPath}/retry`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({});
    const commitResponse = await request(app)
      .post(`${draftPath}/create-card`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ id: cardId.toLowerCase() });
    const deleteResponse = await request(app)
      .delete(draftPath)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token);

    expect(listResponse.body.drafts).toEqual([compatibilityCardDraft]);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(commitResponse.status).toBe(201);
    expect(commitResponse.body).toEqual({
      card: { ...compatibilityCard, id: cardId },
      draftId: compatibilityCardDraft.id,
    });
    expect(deleteResponse.status).toBe(204);

    const calls = vi.mocked(global.fetch).mock.calls as [URL, RequestInit][];
    expect(calls.map(([url]) => url.toString())).toEqual([
      'https://learning-os.example/api/study/card-drafts?limit=200',
      'https://learning-os.example/api/study/card-drafts',
      `https://learning-os.example/api/study/card-drafts/${compatibilityCardDraft.id}`,
      `https://learning-os.example/api/study/card-drafts/${compatibilityCardDraft.id}/retry`,
      `https://learning-os.example/api/study/card-drafts/${compatibilityCardDraft.id}/create-card`,
      `https://learning-os.example/api/study/card-drafts/${compatibilityCardDraft.id}`,
    ]);
    expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: { cueText: '会社' },
      answer: { meaning: 'company' },
      imagePlacement: 'none',
      imagePrompt: 'office building',
    });
    expect(JSON.parse(String(calls[2]?.[1].body))).toEqual({
      prompt: { cueText: '会社' },
      answer: { meaning: 'business' },
      previewAudio: {
        id: 'audio-1',
        filename: 'company.mp3',
        url: null,
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'answer',
    });
    expect(JSON.parse(String(calls[4]?.[1].body))).toEqual({ id: cardId });
    expect(invokedRateLimitKeys).toEqual([
      'learning-os-read-proxy',
      'learning-os-card-draft-create-proxy',
      'learning-os-card-draft-update-proxy',
      'learning-os-card-draft-retry-proxy',
      'learning-os-card-draft-commit-proxy',
      'learning-os-card-draft-delete-proxy',
    ]);
  });

  it('creates vocab bundle drafts through Learning OS under the card-drafts flag', async () => {
    const groupId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            groupId: groupId.toLowerCase(),
            drafts: compatibilityVocabBundleDrafts(groupId),
          }),
          { status: 201 }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({
        targetWord: ' 会社 ',
        sourceSentence: ' 会社で働きます。 ',
        context: ' work ',
        includeLearnerContext: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.groupId).toBe(groupId);
    expect(response.body.drafts).toHaveLength(11);
    const [upstreamUrl, upstreamInit] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(upstreamUrl.toString()).toBe(
      'https://learning-os.example/api/study/card-candidates/vocab-bundle/drafts'
    );
    expect(JSON.parse(String(upstreamInit.body))).toEqual({
      targetWord: '会社',
      sourceSentence: '会社で働きます。',
      context: 'work',
      includeLearnerContext: false,
    });
    expect(invokedRateLimitKeys).toEqual(['learning-os-vocab-bundle-draft-create-proxy']);
  });

  it.each([
    [{ targetWord: ' ' }, 'targetWord is required.'],
    [{ targetWord: '会社', includeLearnerContext: 'yes' }, 'includeLearnerContext'],
    [{ targetWord: '会社', sourceSentence: 'x'.repeat(501) }, 'sourceSentence'],
    [{ targetWord: '会社', context: 'x'.repeat(2001) }, 'context'],
  ])('rejects invalid vocab bundle draft input before forwarding', async (body, message) => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain(message);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a malformed vocab bundle draft response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ groupId: 'not-a-ulid', drafts: [] }), {
          status: 201,
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ targetWord: '会社' });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toContain('invalid vocab bundle draft response');
  });

  it('rejects vocab bundle drafts that do not belong to the returned group', async () => {
    const groupId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            groupId,
            drafts: compatibilityVocabBundleDrafts(groupId).map((draft) => ({
              ...draft,
              variantGroupId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
            })),
          }),
          { status: 201 }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ targetWord: '会社' });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toContain('invalid vocab bundle draft response');
  });

  it.each([
    ['variant kind', { variantKind: 'word_text_recognition' }],
    ['variant stage', { variantStage: 9 }],
    ['variant status', { variantStatus: 'available' }],
  ])('rejects a malformed vocab bundle draft %s', async (_field, override) => {
    const groupId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const drafts = compatibilityVocabBundleDrafts(groupId);
    drafts[3] = { ...drafts[3], ...override };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ groupId, drafts }), {
          status: 201,
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ targetWord: '会社' });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toContain('invalid vocab bundle draft response');
  });

  it.each([
    [
      '/api/learning-os/study/card-drafts',
      { creationKind: 'text-recognition', cardType: 'cloze', prompt: {}, answer: {} },
    ],
    [
      `/api/learning-os/study/card-drafts/${compatibilityCardDraft.id}`,
      { prompt: {}, previewAudioRole: 'front' },
    ],
    [
      `/api/learning-os/study/card-drafts/${compatibilityCardDraft.id}/create-card`,
      { id: 'not-a-ulid' },
    ],
  ])('rejects invalid card-draft writes before forwarding', async (path, body) => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const method = path.endsWith(compatibilityCardDraft.id) ? 'patch' : 'post';

    const response = await request(app)
      [method](path)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send(body);

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps every card-draft route disabled under its child flag', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiCardDrafts: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const listResponse = await request(app)
      .get('/api/learning-os/study/card-drafts')
      .set('Cookie', authCookie());
    const bundleResponse = await request(app)
      .post('/api/learning-os/study/card-candidates/vocab-bundle/drafts')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ targetWord: '会社' });

    expect(listResponse.status).toBe(403);
    expect(bundleResponse.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      'list',
      '/api/learning-os/study/card-drafts',
      {
        drafts: [{ ...compatibilityCardDraft, id: 'not-a-ulid' }],
        total: 1,
        limit: 25,
        nextCursor: null,
      },
    ],
    [
      'commit',
      `/api/learning-os/study/card-drafts/${compatibilityCardDraft.id}/create-card`,
      { ...compatibilityCard, id: 'not-a-ulid' },
    ],
  ])('rejects a malformed card-draft %s response', async (operation, path, upstreamBody) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(upstreamBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    let response;
    if (operation === 'commit') {
      const { cookies, token } = await csrfAuth(app);
      response = await request(app)
        .post(path)
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookies)
        .set(CSRF_TOKEN_HEADER_NAME, token)
        .send({ id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    } else {
      response = await request(app).get(path).set('Cookie', authCookie());
    }

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      `Learning OS Study API returned an invalid card draft ${operation} response.`
    );
  });

  it('proxies the known-kanji response without changing its contract', async () => {
    const knownKanjiResponse = {
      version: 3,
      kanji: ['一', '私'],
      manualKanji: ['私'],
      wanikani: { connected: true, lastSyncedAt: '2026-07-16T12:00:00.000000Z' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(knownKanjiResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/known-kanji')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual(knownKanjiResponse);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/known-kanji');
    expect(init.method).toBe('GET');
  });

  it('validates and proxies manual known-kanji writes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ version: 1, kanji: ['私'], manualKanji: ['私'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/known-kanji/manual')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ kanji: '私', known: true });

    expect(response.status).toBe(200);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/known-kanji/manual');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ kanji: '私', known: true });
  });

  it('rejects invalid manual known-kanji writes before calling Learning OS', async () => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/known-kanji/manual')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ kanji: '会社', known: true });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('trims WaniKani tokens and forwards sync and disconnect without JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ wanikani: { connected: true } }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ added: 1, effectiveTotal: 1, version: 1 }), {
            status: 200,
          })
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const authHeaders = {
      Origin: 'http://localhost:5173',
      Cookie: cookies,
      [CSRF_TOKEN_HEADER_NAME]: token,
    };

    await request(app)
      .put('/api/learning-os/study/wanikani')
      .set(authHeaders)
      .send({ apiToken: ' token-value ' })
      .expect(200);
    await request(app).post('/api/learning-os/study/wanikani/sync').set(authHeaders).expect(200);
    await request(app).delete('/api/learning-os/study/wanikani').set(authHeaders).expect(204);

    const calls = vi.mocked(global.fetch).mock.calls as [URL, RequestInit][];
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ apiToken: 'token-value' });
    expect(calls[1][1].body).toBeUndefined();
    expect(new Headers(calls[1][1].headers).has('Content-Type')).toBe(false);
    expect(calls[2][1].body).toBeUndefined();
  });

  it('proxies normalized New Queue reorders without forwarding client headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(newQueueResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    const response = await request(app)
      .post('/api/learning-os/study/new-queue/reorder')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .set('X-Client-Secret', 'do-not-forward')
      .send({ cardIds: [cardId.toLowerCase()] });

    expect(response.status).toBe(200);
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('X-Client-Secret')).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ cardIds: [cardId] });
  });

  it('rejects proxy writes without a matching CSRF token', async () => {
    const app = await createApp();

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', authCookie())
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Invalid CSRF token.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid or duplicate queue ids before calling Learning OS', async () => {
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    const response = await request(app)
      .post('/api/learning-os/study/new-queue/reorder')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ cardIds: [cardId, cardId.toLowerCase()] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('cardIds must not contain duplicates.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps writes disabled when only the corresponding read flag is enabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: true,
      studyApiSettingsWrite: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps writes disabled when their corresponding read route is off', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: false,
      studyApiSettingsWrite: true,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .patch('/api/learning-os/study/settings')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ newCardsPerDay: 23 });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gates and adapts the New Queue route with its supported query parameters', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiSettings: false,
      studyApiOverview: false,
      studyApiBrowser: false,
      studyApiNewQueue: true,
      studyApiImports: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(newQueueResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/new-queue?cursor=2&limit=25&q=%E4%BC%9A%E7%A4%BE')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/new-queue?cursor=2&limit=25&q=%E4%BC%9A%E7%A4%BE'
    );
    expect(response.body).toEqual({
      items: [
        {
          id: 'card-1',
          noteId: 'note-1',
          cardType: 'recognition',
          displayText: '会社',
          meaning: 'company',
          queuePosition: 2,
          createdAt: '2026-07-15T12:00:00.000Z',
          updatedAt: '2026-07-15T13:00:00.000Z',
        },
      ],
      total: 1,
      limit: 25,
      nextCursor: null,
    });
  });

  it('rejects malformed Laravel study settings instead of leaking an incompatible shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { new_cards_per_day: '17' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid settings response.'
    );
  });

  it('returns a sanitized gateway error when Learning OS returns invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>upstream error page</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/overview')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe(
      'Learning OS Study API returned an invalid JSON response.'
    );
    expect(JSON.stringify(response.body)).not.toContain('upstream error page');
  });

  it('returns a configuration error without falling back when upstream config is missing', async () => {
    process.env.LEARNING_OS_API_TOKEN = '';
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe(
      'Learning OS Study API is enabled but not configured.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a configuration error when the proxy user email is missing', async () => {
    process.env.LEARNING_OS_PROXY_USER_EMAIL = '';
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie());

    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe(
      'Learning OS Study API is enabled but not configured.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects accounts other than the user represented by the initial proxy token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'other@example.com',
      role: 'user',
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings')
      .set('Cookie', authCookie('user-2'));

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe(
      'Learning OS Study API is not enabled for this account.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects direct proxy reads when the parent Study API flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiEnabled: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Learning OS Study API route is not enabled.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects direct proxy reads when the endpoint Study API flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiBrowser: false,
    });
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/browser')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Learning OS Study API route is not enabled.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects query params that are not allowed for the proxied route', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/settings?cursor=not-allowed')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Query parameter "cursor" is not allowed for this Study API route.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    '/api/learning-os/study/browser?q[foo]=bar',
    '/api/learning-os/study/browser?q=one&q=two',
  ])('rejects non-scalar query values before calling Learning OS', async (path) => {
    const app = await createApp();

    const response = await request(app).get(path).set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'Query parameter "q" must be provided exactly once as a string.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a gateway timeout when the upstream Learning OS request hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
    );
    const app = await createApp();

    const pendingResponse = request(app)
      .get('/api/learning-os/study/overview?timeZone=America%2FNew_York')
      .set('Cookie', authCookie())
      .then((response) => response);
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await pendingResponse;

    expect(response.status).toBe(504);
    expect(response.body.error.message).toBe('Learning OS Study API request timed out.');
  });

  it('creates an import session and replaces the private upstream upload URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              import_job: importJobResource,
              upload: {
                method: 'PUT',
                url: 'https://learning-os.example/api/study/imports/private/upload',
                headers: { 'Content-Type': 'application/zip' },
              },
            },
          }),
          { status: 201 }
        )
      )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const response = await request(app)
      .post('/api/learning-os/study/imports')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ filename: ' japanese.colpkg ', contentType: ' Application/ZIP ' });

    expect(response.status).toBe(201);
    expect(response.body.upload).toEqual({
      method: 'PUT',
      url: '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
      headers: { 'Content-Type': 'application/zip' },
    });
    expect(JSON.stringify(response.body)).not.toContain('learning-os.example');
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/study/imports');
    expect(JSON.parse(String(init.body))).toEqual({
      filename: 'japanese.colpkg',
      content_type: 'application/zip',
    });
  });

  it('streams import bytes with only allowlisted headers and adapts the result', async () => {
    const uploadedChunks: Buffer[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: URL, init?: RequestInit & { duplex?: string }) => {
        for await (const chunk of init?.body as unknown as AsyncIterable<Buffer>) {
          uploadedChunks.push(Buffer.from(chunk));
        }

        return new Response(JSON.stringify({ data: importJobResource }), { status: 200 });
      })
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const archive = Buffer.from('PK\u0003\u0004test-archive');

    const response = await request(app)
      .put('/api/learning-os/study/imports/01arz3ndektsv4rrffq69g5faw/upload')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .set('Content-Type', 'application/zip')
      .set('X-Client-Secret', 'do-not-forward')
      .send(archive);

    expect(response.status).toBe(200);
    expect(Buffer.concat(uploadedChunks)).toEqual(archive);
    expect(response.body).toMatchObject({
      id: importJobResource.id,
      sourceFilename: 'japanese.colpkg',
    });
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [
      URL,
      RequestInit & { duplex?: string },
    ];
    expect(url.toString()).toBe(
      'https://learning-os.example/api/study/imports/01arz3ndektsv4rrffq69g5faw/upload'
    );
    expect(init.duplex).toBe('half');
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/zip');
    expect(headers.get('Content-Length')).toBe(String(archive.length));
    expect(headers.has('X-Client-Secret')).toBe(false);
  });

  it.each([
    ['text/plain', '12'],
    ['application/zip', '2147483649'],
    ['application/zip', '9'.repeat(10_000)],
  ])(
    'rejects invalid import upload headers before streaming: %s %s',
    async (contentType, contentLength) => {
      const app = await createApp();
      const { cookies, token } = await csrfAuth(app);

      const response = await request(app)
        .put('/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookies)
        .set(CSRF_TOKEN_HEADER_NAME, token)
        .set('Content-Type', contentType)
        .set('Content-Length', contentLength);

      expect(response.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('proxies current, status, readiness, complete, and cancel through one import flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: null }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: importJobResource }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ready: true, message: null }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: importJobResource }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { ...importJobResource, status: 'failed', error_message: 'Cancelled.' },
            }),
            { status: 200 }
          )
        )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const authHeaders = {
      Origin: 'http://localhost:5173',
      Cookie: cookies,
      [CSRF_TOKEN_HEADER_NAME]: token,
    };

    await request(app)
      .get('/api/learning-os/study/imports/current')
      .set('Cookie', authCookie())
      .expect(200, null);
    await request(app)
      .get('/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW')
      .set('Cookie', authCookie())
      .expect(200);
    await request(app)
      .get('/api/learning-os/study/imports/readiness')
      .set('Cookie', authCookie())
      .expect(200, { ready: true, message: null });
    await request(app)
      .post('/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/complete')
      .set(authHeaders)
      .expect(200);
    await request(app)
      .post('/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/cancel')
      .set(authHeaders)
      .expect(200);

    expect(
      vi
        .mocked(global.fetch)
        .mock.calls.map(([url, init]) => [
          (url as URL).pathname,
          (init as RequestInit).method,
          (init as RequestInit).body,
        ])
    ).toEqual([
      ['/api/study/imports/current', 'GET', undefined],
      ['/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW', 'GET', undefined],
      ['/api/study/imports/readiness', 'GET', undefined],
      ['/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/complete', 'POST', undefined],
      ['/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/cancel', 'POST', undefined],
    ]);
  });

  it('keeps every import lifecycle route disabled under the shared child flag', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      ...enabledStudyApiFlags,
      studyApiImports: false,
    });
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    const readResponse = await request(app)
      .get('/api/learning-os/study/imports/current')
      .set('Cookie', authCookie());
    const writeResponse = await request(app)
      .post('/api/learning-os/study/imports')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies)
      .set(CSRF_TOKEN_HEADER_NAME, token)
      .send({ filename: 'japanese.colpkg' });

    expect(readResponse.status).toBe(403);
    expect(writeResponse.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsafe import id path segments before building the upstream URL', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/imports/..')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when Learning OS returns a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ stack: 'internal upstream details' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW')
      .set('Cookie', authCookie());

    expect(response.status).toBe(502);
    expect(response.body.error.message).toBe('Learning OS Study API request failed.');
    expect(JSON.stringify(response.body)).not.toContain('internal upstream details');
  });

  it('surfaces bounded New Queue card validation messages from Learning OS', async () => {
    const validationMessage = 'Every reordered card must be an active new card owned by the user.';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'The given data was invalid.',
              errors: {
                'cardIds.0': [validationMessage],
                internalField: ['do not expose this detail'],
              },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: { cardIds: [validationMessage] } }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          })
        )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)
        .post('/api/learning-os/study/new-queue/reorder')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookies)
        .set(CSRF_TOKEN_HEADER_NAME, token)
        .send({ cardIds: ['01ARZ3NDEKTSV4RRFFQ69G5FAV'] });

      expect(response.status).toBe(422);
      expect(response.body.error.message).toBe(validationMessage);
      expect(JSON.stringify(response.body)).not.toContain('internalField');
      expect(JSON.stringify(response.body)).not.toContain('do not expose this detail');
    }
  });

  it('sanitizes malformed, oversized, and control-character queue validation responses', async () => {
    const oversizedMessage = 'x'.repeat(501);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: { cardIds: [oversizedMessage] } }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: { cardIds: 'not-an-array' } }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: { cardIds: ['unsafe\nlog line'] } }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ errors: { cardIds: ['unsafe\u0085\u2028\u202elog line'] } }),
            {
              status: 422,
              headers: { 'content-type': 'application/json' },
            }
          )
        )
    );
    const app = await createApp();
    const { cookies, token } = await csrfAuth(app);
    const requestReorder = () =>
      request(app)
        .post('/api/learning-os/study/new-queue/reorder')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', cookies)
        .set(CSRF_TOKEN_HEADER_NAME, token)
        .send({ cardIds: ['01ARZ3NDEKTSV4RRFFQ69G5FAV'] });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await requestReorder();
      expect(response.status).toBe(422);
      expect(response.body.error.message).toBe('Learning OS Study API request failed.');
      expect(JSON.stringify(response.body)).not.toContain(oversizedMessage);
    }
  });

  it('rejects routes outside the read-only Study API allowlist', async () => {
    const app = await createApp();

    const response = await request(app)
      .get('/api/learning-os/study/cards/card-1/actions')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
