import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  STUDY_CANDIDATE_COMMIT_MAX_COUNT,
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants';
import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  apiCsrfProtection,
  apiCsrfErrorHandler,
  issueCsrfTokenCookie,
  requireAllowedApiMutationOrigin,
} from '../../../middleware/csrf.js';
import { resetBrowserRuntimeTestState } from '../../helpers/browserRuntimeTestHelper.js';
import { getSetCookieArray, testCookieParser } from '../../helpers/testCookieParser.js';
import { mockPrisma } from '../../setup.js';

const {
  cancelStudyImportUploadMock,
  completeStudyImportUploadMock,
  createStudyImportUploadSessionMock,
  createRedisConnectionMock,
  commitStudyCardCandidatesMock,
  completeManualStudyCardDraftMock,
  createStudyVocabBundleDraftsMock,
  execMock,
  createManualCardDraftMock,
  createStudyCardFromManualDraftMock,
  deleteManualCardDraftMock,
  enqueueStudyManualCardDraftJobMock,
  enqueueStudyVocabBundleDraftJobMock,
  expireAtMock,
  exportStudyCardsSectionMock,
  exportStudyImportsSectionMock,
  exportStudyMediaSectionMock,
  exportStudyReviewLogsSectionMock,
  getCurrentStudyImportJobMock,
  getStudyMediaAccessMock,
  getStudyImportUploadReadinessMock,
  generateStudyCardCandidatesMock,
  generateManualStudyCardDraftImageMock,
  listManualCardDraftsMock,
  multiMock,
  regenerateStudyCardCandidatePreviewAudioMock,
  regenerateStudyCardCandidatePreviewImageMock,
  resetManualCardDraftForRetryMock,
  triggerWorkerJobMock,
  updateManualCardDraftMock,
} = vi.hoisted(() => ({
  cancelStudyImportUploadMock: vi.fn(),
  completeStudyImportUploadMock: vi.fn(),
  createStudyImportUploadSessionMock: vi.fn(),
  createRedisConnectionMock: vi.fn(),
  commitStudyCardCandidatesMock: vi.fn(),
  completeManualStudyCardDraftMock: vi.fn(),
  createStudyVocabBundleDraftsMock: vi.fn(),
  execMock: vi.fn(),
  createManualCardDraftMock: vi.fn(),
  createStudyCardFromManualDraftMock: vi.fn(),
  deleteManualCardDraftMock: vi.fn(),
  enqueueStudyManualCardDraftJobMock: vi.fn(),
  enqueueStudyVocabBundleDraftJobMock: vi.fn(),
  expireAtMock: vi.fn(),
  exportStudyCardsSectionMock: vi.fn(),
  exportStudyImportsSectionMock: vi.fn(),
  exportStudyMediaSectionMock: vi.fn(),
  exportStudyReviewLogsSectionMock: vi.fn(),
  getCurrentStudyImportJobMock: vi.fn(),
  getStudyMediaAccessMock: vi.fn(),
  getStudyImportUploadReadinessMock: vi.fn(),
  generateStudyCardCandidatesMock: vi.fn(),
  generateManualStudyCardDraftImageMock: vi.fn(),
  listManualCardDraftsMock: vi.fn(),
  multiMock: vi.fn(),
  regenerateStudyCardCandidatePreviewAudioMock: vi.fn(),
  regenerateStudyCardCandidatePreviewImageMock: vi.fn(),
  resetManualCardDraftForRetryMock: vi.fn(),
  triggerWorkerJobMock: vi.fn(),
  updateManualCardDraftMock: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { userId: string }).userId = 'user-1';
    next();
  },
  AuthRequest: class {},
}));

vi.mock('../../../services/studyService.js', () => ({
  cancelStudyImportUpload: cancelStudyImportUploadMock,
  completeStudyImportUpload: completeStudyImportUploadMock,
  completeManualStudyCardDraft: completeManualStudyCardDraftMock,
  createManualCardDraft: createManualCardDraftMock,
  createStudyCardFromManualDraft: createStudyCardFromManualDraftMock,
  createStudyVocabBundleDrafts: createStudyVocabBundleDraftsMock,
  deleteManualCardDraft: deleteManualCardDraftMock,
  commitStudyCardCandidates: commitStudyCardCandidatesMock,
  createStudyImportUploadSession: createStudyImportUploadSessionMock,
  exportStudyData: vi.fn(),
  exportStudyCardsSection: exportStudyCardsSectionMock,
  exportStudyImportsSection: exportStudyImportsSectionMock,
  exportStudyMediaSection: exportStudyMediaSectionMock,
  exportStudyReviewLogsSection: exportStudyReviewLogsSectionMock,
  getCurrentStudyImportJob: getCurrentStudyImportJobMock,
  getStudyMediaAccess: getStudyMediaAccessMock,
  getStudyImportJob: vi.fn(),
  getStudyImportUploadReadiness: getStudyImportUploadReadinessMock,
  generateStudyCardCandidates: generateStudyCardCandidatesMock,
  generateManualStudyCardDraftImage: generateManualStudyCardDraftImageMock,
  listManualCardDrafts: listManualCardDraftsMock,
  regenerateStudyCardCandidatePreviewAudio: regenerateStudyCardCandidatePreviewAudioMock,
  regenerateStudyCardCandidatePreviewImage: regenerateStudyCardCandidatePreviewImageMock,
  resetManualCardDraftForRetry: resetManualCardDraftForRetryMock,
  updateManualCardDraft: updateManualCardDraftMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
  defaultWorkerSettings: { concurrency: 1 },
}));

vi.mock('../../../jobs/studyManualCardDraftQueue.js', () => ({
  enqueueStudyManualCardDraftJob: enqueueStudyManualCardDraftJobMock,
}));

vi.mock('../../../jobs/studyVocabBundleDraftQueue.js', () => ({
  enqueueStudyVocabBundleDraftJob: enqueueStudyVocabBundleDraftJobMock,
}));

vi.mock('../../../services/workerTrigger.js', () => ({
  triggerWorkerJob: triggerWorkerJobMock,
}));

describe('Study Routes', () => {
  const originalEnv = process.env;
  let app: express.Application;
  let studyRouter: Router;
  let testClockOffset = 0;
  let temporaryDirectory: string;
  let csrfCookies: string[] = [];
  let csrfToken = '';

  function withMutationCsrf(
    requestBuilder: request.Test,
    origin: string = 'http://localhost:5173'
  ) {
    return requestBuilder
      .set('Origin', origin)
      .set('Cookie', csrfCookies)
      .set(CSRF_TOKEN_HEADER_NAME, csrfToken);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    cancelStudyImportUploadMock.mockReset();
    commitStudyCardCandidatesMock.mockReset();
    completeManualStudyCardDraftMock.mockReset();
    createStudyVocabBundleDraftsMock.mockReset();
    createManualCardDraftMock.mockReset();
    createStudyCardFromManualDraftMock.mockReset();
    createStudyImportUploadSessionMock.mockReset();
    completeStudyImportUploadMock.mockReset();
    deleteManualCardDraftMock.mockReset();
    enqueueStudyManualCardDraftJobMock.mockReset();
    enqueueStudyVocabBundleDraftJobMock.mockReset();
    generateStudyCardCandidatesMock.mockReset();
    generateManualStudyCardDraftImageMock.mockReset();
    listManualCardDraftsMock.mockReset();
    regenerateStudyCardCandidatePreviewAudioMock.mockReset();
    regenerateStudyCardCandidatePreviewImageMock.mockReset();
    resetManualCardDraftForRetryMock.mockReset();
    triggerWorkerJobMock.mockReset();
    updateManualCardDraftMock.mockReset();
    getCurrentStudyImportJobMock.mockReset();
    getStudyImportUploadReadinessMock.mockReset();
    process.env = {
      ...originalEnv,
      CLIENT_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    };
    resetBrowserRuntimeTestState();
    expireAtMock.mockReset();
    execMock.mockReset();
    multiMock.mockReset();
    expireAtMock.mockResolvedValue(1);
    execMock.mockResolvedValue([
      [null, 1],
      [null, 1],
    ]);
    multiMock.mockImplementation(() => {
      const pipeline = {
        incr: vi.fn().mockReturnThis(),
        expireat: vi.fn().mockReturnThis(),
        exec: execMock,
      };
      return pipeline;
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRedisConnectionMock.mockReset();
    createRedisConnectionMock.mockReturnValue({
      multi: multiMock,
    });
    triggerWorkerJobMock.mockResolvedValue(undefined);
    getStudyMediaAccessMock.mockResolvedValue(null);
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'study-route-test-'));
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(`2026-04-21T${String(12 + (testClockOffset % 12)).padStart(2, '0')}:00:00.000Z`)
    );
    testClockOffset += 1;
    app = express();
    app.use(testCookieParser);
    app.use(expressJson());
    app.use('/api/auth', requireAllowedApiMutationOrigin);
    app.use('/api/auth', apiCsrfProtection);
    app.use('/study', requireAllowedApiMutationOrigin);
    app.use('/study', apiCsrfProtection);
    app.get('/api/auth/csrf', (req, res) => {
      issueCsrfTokenCookie(req, res, 'lax');
      res.status(204).end();
    });
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const module = await import('../../../routes/study.js');
    studyRouter = module.default;
    app.use('/study', studyRouter);
    app.use((_req, res) => {
      res.status(404).json({ message: 'Not found.' });
    });
    app.use(apiCsrfErrorHandler);
    app.use(((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
      res.status(statusCode).json({ message });
    }) as ErrorRequestHandler);

    const csrfResponse = await request(app)
      .get('/api/auth/csrf')
      .set('Origin', 'http://localhost:5173');
    csrfCookies = getSetCookieArray(csrfResponse.headers['set-cookie']);
    const tokenCookie = csrfCookies
      .map((value) => value.split(';')[0])
      .find((value) => value.startsWith(`${CSRF_TOKEN_COOKIE_NAME}=`));
    csrfToken = tokenCookie
      ? decodeURIComponent(tokenCookie.slice(`${CSRF_TOKEN_COOKIE_NAME}=`.length))
      : '';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    resetBrowserRuntimeTestState();
  });

  it('generates study card candidates with learner context enabled by default', async () => {
    generateStudyCardCandidatesMock.mockResolvedValue({
      candidates: [],
      learnerContextSummary: null,
    });

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/generate')
    ).send({
      targetText: '会社',
      context: 'Business vocabulary',
    });

    expect(response.status).toBe(200);
    expect(generateStudyCardCandidatesMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: {
        targetText: '会社',
        context: 'Business vocabulary',
        includeLearnerContext: true,
      },
    });
  });

  it('trims generated candidate input before calling the service', async () => {
    generateStudyCardCandidatesMock.mockResolvedValue({
      candidates: [],
      learnerContextSummary: null,
    });

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/generate')
    ).send({
      targetText: '  会社  ',
      context: '  Business vocabulary  ',
      includeLearnerContext: false,
    });

    expect(response.status).toBe(200);
    expect(generateStudyCardCandidatesMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: {
        targetText: '会社',
        context: 'Business vocabulary',
        includeLearnerContext: false,
      },
    });
  });

  it('rejects blank generated candidate targets before hitting the service', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/generate')
    ).send({
      targetText: '   ',
      context: 'Business vocabulary',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('targetText is required');
    expect(generateStudyCardCandidatesMock).not.toHaveBeenCalled();
  });

  it('rejects overlong generated candidate inputs before hitting the service', async () => {
    const targetResponse = await withMutationCsrf(
      request(app).post('/study/card-candidates/generate')
    ).send({
      targetText: 'a'.repeat(STUDY_CANDIDATE_TARGET_MAX_LENGTH + 1),
    });

    expect(targetResponse.status).toBe(400);
    expect(targetResponse.body.message).toContain('targetText must be');
    expect(generateStudyCardCandidatesMock).not.toHaveBeenCalled();

    const contextResponse = await withMutationCsrf(
      request(app).post('/study/card-candidates/generate')
    ).send({
      targetText: '会社',
      context: 'a'.repeat(STUDY_CANDIDATE_CONTEXT_MAX_LENGTH + 1),
    });

    expect(contextResponse.status).toBe(400);
    expect(contextResponse.body.message).toContain('context must be');
    expect(generateStudyCardCandidatesMock).not.toHaveBeenCalled();
  });

  it('queues generated vocab bundles as async manual drafts', async () => {
    createStudyVocabBundleDraftsMock.mockResolvedValue({
      groupId: 'group-1',
      drafts: [{ id: 'draft-1', status: 'generating' }],
    });
    enqueueStudyVocabBundleDraftJobMock.mockResolvedValue(undefined);
    triggerWorkerJobMock.mockResolvedValue(undefined);

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/vocab-bundle/drafts')
    ).send({
      targetWord: ' 営業する ',
      sourceSentence: ' 営業の仕事は楽しいです。 ',
      context: ' Business chapter ',
      includeLearnerContext: false,
    });

    expect(response.status).toBe(201);
    expect(response.body.groupId).toBe('group-1');
    expect(createStudyVocabBundleDraftsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: {
        targetWord: ' 営業する ',
        sourceSentence: ' 営業の仕事は楽しいです。 ',
        context: ' Business chapter ',
        includeLearnerContext: false,
      },
    });
    expect(enqueueStudyVocabBundleDraftJobMock).toHaveBeenCalledWith('group-1');
    expect(triggerWorkerJobMock).toHaveBeenCalled();
  });

  it('regenerates candidate preview audio after validating the candidate payload', async () => {
    regenerateStudyCardCandidatePreviewAudioMock.mockResolvedValue({
      prompt: { cueMeaning: 'company' },
      answer: {
        expression: '会社',
        meaning: 'company',
        answerAudio: {
          id: 'media-regenerated',
          filename: 'candidate-regenerated.mp3',
          url: '/api/study/media/media-regenerated',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      previewAudio: {
        id: 'media-regenerated',
        filename: 'candidate-regenerated.mp3',
        url: '/api/study/media/media-regenerated',
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'answer',
    });

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/regenerate-audio')
    ).send({
      candidate: {
        clientId: 'produce-company',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: 'company' },
        answer: {
          expression: '会社',
          meaning: 'company',
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.previewAudio.id).toBe('media-regenerated');
    expect(regenerateStudyCardCandidatePreviewAudioMock).toHaveBeenCalledWith({
      userId: 'user-1',
      candidate: expect.objectContaining({
        candidateKind: 'production',
        cardType: 'production',
        previewAudio: null,
      }),
    });
  });

  it('regenerates candidate preview images after validating the candidate payload', async () => {
    regenerateStudyCardCandidatePreviewImageMock.mockResolvedValue({
      prompt: {
        cueMeaning: '名詞',
        cueImage: {
          id: 'image-regenerated',
          filename: 'candidate-regenerated.png',
          url: '/api/study/media/image-regenerated',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answer: {
        expression: '曇り',
        meaning: 'cloudy weather',
      },
      previewImage: {
        id: 'image-regenerated',
        filename: 'candidate-regenerated.png',
        url: '/api/study/media/image-regenerated',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: '  A clear image of cloudy weather.  ',
    });

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/regenerate-image')
    ).send({
      imagePrompt: 'A clear image of cloudy weather.',
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
        imagePrompt: 'A clear image of cloudy weather.',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.previewImage.id).toBe('image-regenerated');
    expect(regenerateStudyCardCandidatePreviewImageMock).toHaveBeenCalledWith({
      userId: 'user-1',
      imagePrompt: 'A clear image of cloudy weather.',
      candidate: expect.objectContaining({
        candidateKind: 'production',
        cardType: 'production',
      }),
    });
  });

  it('rate limits candidate image regeneration more tightly than other candidate writes', async () => {
    execMock.mockResolvedValueOnce([
      [null, 11],
      [null, 1],
    ]);

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/regenerate-image')
    ).send({
      imagePrompt: 'A clear image of cloudy weather.',
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
      },
    });

    expect(response.status).toBe(429);
    expect(response.body.message).toContain('Too many study requests');
    expect(regenerateStudyCardCandidatePreviewImageMock).not.toHaveBeenCalled();
  });

  it('rejects blank candidate image prompts before regenerating images', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/regenerate-image')
    ).send({
      imagePrompt: '   ',
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('imagePrompt is required.');
    expect(regenerateStudyCardCandidatePreviewImageMock).not.toHaveBeenCalled();
  });

  it('lets the candidate service own image prompt length validation', async () => {
    regenerateStudyCardCandidatePreviewImageMock.mockRejectedValueOnce(
      Object.assign(
        new Error(
          `imagePrompt must be ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters or fewer.`
        ),
        { statusCode: 400 }
      )
    );

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/regenerate-image')
    ).send({
      imagePrompt: 'a'.repeat(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH + 1),
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('imagePrompt must be');
    expect(regenerateStudyCardCandidatePreviewImageMock).toHaveBeenCalledWith({
      userId: 'user-1',
      imagePrompt: 'a'.repeat(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH + 1),
      candidate: expect.objectContaining({
        candidateKind: 'production',
      }),
    });
  });

  it('completes a manual study card draft after validating creation kind and payloads', async () => {
    completeManualStudyCardDraftMock.mockResolvedValue({
      creationKind: 'production-text',
      cardType: 'production',
      prompt: { cueText: 'company' },
      answer: { expression: '会社', meaning: 'company' },
      imagePlacement: 'none',
      imagePrompt: 'A realistic photo of a company office. No text.',
      previewImage: null,
    });

    const response = await withMutationCsrf(request(app).post('/study/cards/draft/complete')).send({
      creationKind: 'production-text',
      cardType: 'production',
      prompt: { cueText: 'company' },
      answer: { expression: '', meaning: '' },
      imagePlacement: 'none',
      imagePrompt: null,
    });

    expect(response.status).toBe(200);
    expect(response.body.imagePrompt).toContain('company office');
    expect(completeManualStudyCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: expect.objectContaining({
        creationKind: 'production-text',
        cardType: 'production',
        imagePlacement: 'none',
      }),
    });
  });

  it('derives manual draft card type from creation kind when client state is stale', async () => {
    const response = await withMutationCsrf(request(app).post('/study/cards/draft/complete')).send({
      creationKind: 'production-image',
      cardType: 'recognition',
      prompt: {},
      answer: {},
    });

    expect(response.status).toBe(200);
    expect(completeManualStudyCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: expect.objectContaining({
        creationKind: 'production-image',
        cardType: 'production',
      }),
    });
  });

  it('generates a manual draft image preview for a selected placement', async () => {
    generateManualStudyCardDraftImageMock.mockResolvedValue({
      previewImage: {
        id: 'manual-image-1',
        filename: 'manual-image.webp',
        url: '/api/study/media/manual-image-1',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A realistic photo of cloudy weather. No text.',
      imagePlacement: 'both',
    });

    const response = await withMutationCsrf(request(app).post('/study/cards/draft/image')).send({
      imagePrompt: ' A realistic photo of cloudy weather. No text. ',
      imagePlacement: 'both',
    });

    expect(response.status).toBe(200);
    expect(response.body.previewImage.id).toBe('manual-image-1');
    expect(generateManualStudyCardDraftImageMock).toHaveBeenCalledWith({
      userId: 'user-1',
      imagePrompt: 'A realistic photo of cloudy weather. No text.',
      imagePlacement: 'both',
    });
  });

  it('creates a manual card draft, enqueues completion, and returns immediately', async () => {
    createManualCardDraftMock.mockResolvedValue({
      id: 'draft-1',
      status: 'generating',
      creationKind: 'cloze',
      cardType: 'cloze',
      prompt: { clozeText: '試合に[勝ちました]。' },
      answer: {},
      imagePlacement: 'both',
      imagePrompt: null,
      previewAudio: null,
      previewAudioRole: null,
      previewImage: null,
      errorMessage: null,
      createdAt: '2026-05-08T12:00:00.000Z',
      updatedAt: '2026-05-08T12:00:00.000Z',
    });

    const response = await withMutationCsrf(request(app).post('/study/card-drafts')).send({
      creationKind: 'cloze',
      cardType: 'cloze',
      prompt: { clozeText: '試合に[勝ちました]。' },
      answer: {},
      imagePlacement: 'both',
      imagePrompt: null,
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('draft-1');
    expect(createManualCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: expect.objectContaining({
        creationKind: 'cloze',
        cardType: 'cloze',
        imagePlacement: 'both',
      }),
    });
    expect(enqueueStudyManualCardDraftJobMock).toHaveBeenCalledWith('draft-1');
    expect(triggerWorkerJobMock).toHaveBeenCalled();
  });

  it('lists, autosaves, retries, creates, and deletes manual card drafts', async () => {
    const draft = {
      id: 'draft-1',
      status: 'ready',
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: { cueText: '会社' },
      answer: { expression: '会社', meaning: 'company' },
      imagePlacement: 'none',
      imagePrompt: null,
      previewAudio: null,
      previewAudioRole: null,
      previewImage: null,
      errorMessage: null,
      createdAt: '2026-05-08T12:00:00.000Z',
      updatedAt: '2026-05-08T12:00:00.000Z',
    };
    listManualCardDraftsMock.mockResolvedValue({
      drafts: [draft],
      total: 1,
      limit: 200,
      nextCursor: null,
    });
    updateManualCardDraftMock.mockResolvedValue({
      ...draft,
      answer: { expression: '会社', meaning: 'business' },
    });
    resetManualCardDraftForRetryMock.mockResolvedValue({ ...draft, status: 'generating' });
    createStudyCardFromManualDraftMock.mockResolvedValue({
      draftId: 'draft-1',
      card: { id: 'card-1', cardType: 'recognition' },
    });
    deleteManualCardDraftMock.mockResolvedValue(undefined);

    const listResponse = await request(app).get('/study/card-drafts');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.drafts).toHaveLength(1);
    expect(listManualCardDraftsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 200,
    });

    const patchResponse = await withMutationCsrf(
      request(app).patch('/study/card-drafts/draft-1')
    ).send({
      prompt: { cueText: '会社' },
      answer: { expression: '会社', meaning: 'business' },
      imagePlacement: 'none',
      imagePrompt: null,
      previewAudio: null,
      previewAudioRole: null,
      previewImage: null,
    });
    expect(patchResponse.status).toBe(200);
    expect(updateManualCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      draftId: 'draft-1',
      request: expect.objectContaining({
        answer: { expression: '会社', meaning: 'business' },
      }),
    });

    const retryResponse = await withMutationCsrf(
      request(app).post('/study/card-drafts/draft-1/retry')
    ).send({});
    expect(retryResponse.status).toBe(200);
    expect(resetManualCardDraftForRetryMock).toHaveBeenCalledWith({
      userId: 'user-1',
      draftId: 'draft-1',
    });
    expect(enqueueStudyManualCardDraftJobMock).toHaveBeenCalledWith('draft-1');

    const createResponse = await withMutationCsrf(
      request(app).post('/study/card-drafts/draft-1/create-card')
    ).send({});
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.card.id).toBe('card-1');
    expect(createStudyCardFromManualDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      draftId: 'draft-1',
    });

    const deleteResponse = await withMutationCsrf(
      request(app).delete('/study/card-drafts/draft-1')
    );
    expect(deleteResponse.status).toBe(204);
    expect(deleteManualCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      draftId: 'draft-1',
    });
  });

  it('rejects malformed manual draft autosave payloads', async () => {
    const response = await withMutationCsrf(request(app).patch('/study/card-drafts/draft-1')).send({
      prompt: { cueText: '会社' },
      answer: { expression: '会社' },
      previewAudioRole: 'front',
    });

    expect(response.status).toBe(400);
    expect(updateManualCardDraftMock).not.toHaveBeenCalled();
  });

  it('commits selected generated candidates after validating media refs', async () => {
    commitStudyCardCandidatesMock.mockResolvedValue({
      cards: [{ id: 'card-1', cardType: 'recognition' }],
    });

    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/commit')
    ).send({
      candidates: [
        {
          clientId: 'listen-company',
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          prompt: {
            cueAudio: {
              id: 'media-1',
              filename: 'listen-company.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answer: {
            expression: '会社',
            meaning: 'company',
            answerAudio: {
              id: 'media-1',
              filename: 'listen-company.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          previewAudio: {
            id: 'media-1',
            filename: 'listen-company.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'prompt',
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(commitStudyCardCandidatesMock).toHaveBeenCalledWith({
      userId: 'user-1',
      candidates: [
        expect.objectContaining({
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          previewAudioRole: 'prompt',
        }),
      ],
    });
  });

  it('rejects generated candidate commits over the route cap before parsing items', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/commit')
    ).send({
      candidates: Array.from({ length: STUDY_CANDIDATE_COMMIT_MAX_COUNT + 1 }, () => null),
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      `no more than ${String(STUDY_CANDIDATE_COMMIT_MAX_COUNT)} cards`
    );
    expect(commitStudyCardCandidatesMock).not.toHaveBeenCalled();
  });

  it('rejects generated candidate commits with mismatched card type', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/card-candidates/commit')
    ).send({
      candidates: [
        {
          clientId: 'bad-kind',
          candidateKind: 'audio-recognition',
          cardType: 'production',
          prompt: {},
          answer: { expression: '会社' },
        },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('cardType must match candidateKind');
    expect(commitStudyCardCandidatesMock).not.toHaveBeenCalled();
  });

  it('rejects non-.colpkg upload session requests before creation', async () => {
    const response = await withMutationCsrf(request(app).post('/study/imports')).send({
      filename: 'anki-export.txt',
      contentType: 'application/zip',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Only .colpkg Anki collection backups are accepted');
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('creates a study import upload session', async () => {
    createStudyImportUploadSessionMock.mockResolvedValueOnce({
      importJob: {
        id: 'import-1',
        status: 'pending',
        sourceFilename: 'anki-export.colpkg',
        deckName: '日本語',
        preview: {
          deckName: '日本語',
          cardCount: 0,
          noteCount: 0,
          reviewLogCount: 0,
          mediaReferenceCount: 0,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
        uploadedAt: null,
        uploadExpiresAt: '2026-04-21T01:00:00.000Z',
        sourceSizeBytes: null,
        importedAt: null,
        errorMessage: null,
      },
      upload: {
        method: 'PUT',
        url: 'https://uploads.example/import-1',
        headers: {
          'Content-Type': 'application/zip',
        },
      },
    });

    const response = await withMutationCsrf(request(app).post('/study/imports')).send({
      filename: 'anki-export.colpkg',
      contentType: 'application/zip',
    });

    expect(response.status).toBe(201);
    expect(createStudyImportUploadSessionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      filename: 'anki-export.colpkg',
      contentType: 'application/zip',
    });
    expect(response.body.upload.url).toContain('uploads.example');
  });

  it('completes a study import upload and enqueues processing', async () => {
    completeStudyImportUploadMock.mockResolvedValueOnce({
      id: 'import-1',
      status: 'pending',
      sourceFilename: 'anki-export.colpkg',
      deckName: '日本語',
      preview: {
        deckName: '日本語',
        cardCount: 0,
        noteCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
      uploadedAt: new Date('2026-04-21T00:00:00.000Z').toISOString(),
      uploadExpiresAt: '2026-04-21T01:00:00.000Z',
      sourceSizeBytes: 1024,
      importedAt: null,
      errorMessage: null,
    });

    const response = await withMutationCsrf(request(app).post('/study/imports/import-1/complete'));

    expect(response.status).toBe(202);
    expect(completeStudyImportUploadMock).toHaveBeenCalledWith({
      userId: 'user-1',
      importJobId: 'import-1',
    });
    expect(response.body.id).toBe('import-1');
  });

  it('returns the current pending or processing study import', async () => {
    getCurrentStudyImportJobMock.mockResolvedValueOnce({
      id: 'import-1',
      status: 'processing',
      sourceFilename: 'anki-export.colpkg',
      deckName: '日本語',
      preview: {
        deckName: '日本語',
        cardCount: 0,
        noteCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
      uploadedAt: '2026-04-21T00:00:00.000Z',
      uploadExpiresAt: '2026-04-21T01:00:00.000Z',
      sourceSizeBytes: 1024,
      importedAt: null,
      errorMessage: null,
    });

    const response = await request(app).get('/study/imports/current');

    expect(response.status).toBe(200);
    expect(getCurrentStudyImportJobMock).toHaveBeenCalledWith('user-1');
    expect(response.body.id).toBe('import-1');
  });

  it('returns study import upload readiness', async () => {
    getStudyImportUploadReadinessMock.mockResolvedValueOnce({
      ready: false,
      message: 'Configure the storage bucket CORS policy.',
    });

    const response = await request(app).get('/study/imports/readiness');

    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(false);
    expect(response.body.message).toContain('CORS');
  });

  it('cancels a pending study import upload', async () => {
    cancelStudyImportUploadMock.mockResolvedValueOnce({
      id: 'import-1',
      status: 'failed',
      sourceFilename: 'anki-export.colpkg',
      deckName: '日本語',
      preview: {
        deckName: '日本語',
        cardCount: 0,
        noteCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
      uploadedAt: null,
      uploadExpiresAt: '2026-04-21T01:00:00.000Z',
      sourceSizeBytes: null,
      importedAt: null,
      errorMessage: 'Study import upload was cancelled.',
    });

    const response = await withMutationCsrf(request(app).post('/study/imports/import-1/cancel'));

    expect(response.status).toBe(200);
    expect(cancelStudyImportUploadMock).toHaveBeenCalledWith({
      userId: 'user-1',
      importJobId: 'import-1',
    });
    expect(response.body.status).toBe('failed');
  });

  it('returns 503 for import cancellation when study rate limiting is unavailable', async () => {
    execMock.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await withMutationCsrf(request(app).post('/study/imports/import-1/cancel'));

    expect(response.status).toBe(503);
    expect(response.body.message).toContain('rate limiting is temporarily unavailable');
    expect(cancelStudyImportUploadMock).not.toHaveBeenCalled();
  });

  it('returns 503 for imports when study rate limiting is unavailable', async () => {
    execMock.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await withMutationCsrf(request(app).post('/study/imports')).send({
      filename: 'anki-export.colpkg',
      contentType: 'application/zip',
    });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain('rate limiting is temporarily unavailable');
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('serves authenticated study media through the study media route', async () => {
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'redirect',
      redirectUrl: 'https://example.com/study-audio.mp3',
      contentType: 'audio/mpeg',
      contentDisposition: 'inline',
      filename: 'audio.mp3',
    });

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://example.com/study-audio.mp3');
    expect(getStudyMediaAccessMock).toHaveBeenCalledWith('user-1', 'media-1');
  });

  it('rate limits repeated study media reads', async () => {
    execMock.mockResolvedValueOnce([
      [null, 241],
      [null, 1],
    ]);

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(429);
    expect(response.body.message).toContain('Too many study requests');
    expect(getStudyMediaAccessMock).not.toHaveBeenCalled();
  });

  it('returns the lightweight study export manifest', async () => {
    const { exportStudyData } = await import('../../../services/studyService.js');
    vi.mocked(exportStudyData).mockResolvedValue({
      exportedAt: '2026-04-21T12:00:00.000Z',
      sections: {
        cards: { total: 10 },
        reviewLogs: { total: 20 },
        media: { total: 5 },
        imports: { total: 1 },
      },
    });

    const response = await request(app).get('/study/export');

    expect(response.status).toBe(200);
    expect(response.body.sections.cards.total).toBe(10);
    expect(exportStudyData).toHaveBeenCalledWith('user-1');
  });

  it('passes export cards pagination params through to the service', async () => {
    exportStudyCardsSectionMock.mockResolvedValue({
      items: [],
      nextCursor: 'cursor-2',
    });

    const response = await request(app).get('/study/export/cards?cursor=cursor-1&limit=250');

    expect(response.status).toBe(200);
    expect(exportStudyCardsSectionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: 'cursor-1',
      limit: 250,
    });
  });

  it('rejects export cursors longer than 1000 characters', async () => {
    const response = await request(app).get(`/study/export/cards?cursor=${'a'.repeat(1001)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('cursor must be 1000 characters or fewer');
    expect(exportStudyCardsSectionMock).not.toHaveBeenCalled();
  });

  it('defaults export section pagination when omitted', async () => {
    exportStudyReviewLogsSectionMock.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await request(app).get('/study/export/review-logs');

    expect(response.status).toBe(200);
    expect(exportStudyReviewLogsSectionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 500,
    });
  });

  it('blocks study routes when the flashcards feature flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: false,
    });

    const response = await request(app).get('/study/imports/readiness');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('blocks study routes when the flashcards feature flag row is missing', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

    const response = await request(app).get('/study/imports/readiness');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('blocks study mutation routes for cross-origin requests', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/imports'),
      'https://evil.example.com'
    ).send({});

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Invalid request origin');
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('allows read-only study routes without same-origin mutation headers', async () => {
    getStudyImportUploadReadinessMock.mockResolvedValue({
      ready: true,
      message: null,
    });

    const response = await request(app).get('/study/imports/readiness');

    expect(response.status).toBe(200);
    expect(getStudyImportUploadReadinessMock).toHaveBeenCalled();
  });

  it.each([
    '/study/overview',
    '/study/settings',
    '/study/new-queue',
    '/study/browser',
    '/study/browser/note-1',
  ])('does not expose the retired read route %s', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(404);
  });

  it.each([
    ['patch', '/study/settings'],
    ['post', '/study/new-queue/reorder'],
    ['post', '/study/session/start'],
    ['post', '/study/reviews'],
    ['post', '/study/reviews/undo'],
    ['post', '/study/cards'],
    ['patch', '/study/cards/card-1'],
    ['delete', '/study/cards/card-1'],
    ['post', '/study/cards/card-1/pitch-accent'],
    ['post', '/study/cards/card-1/actions'],
    ['post', '/study/cards/card-1/prepare-answer-audio'],
    ['post', '/study/cards/card-1/regenerate-answer-audio'],
    ['post', '/study/cards/card-1/regenerate-image'],
  ] as const)('does not expose the retired mutation route %s %s', async (method, path) => {
    const response = await withMutationCsrf(request(app)[method](path)).send({});

    expect(response.status).toBe(404);
  });

  it('rejects mutation requests when Origin is absent', async () => {
    const response = await request(app)
      .post('/study/imports')
      .set('Cookie', csrfCookies)
      .set(CSRF_TOKEN_HEADER_NAME, csrfToken)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Invalid request origin');
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('rejects mutation requests when the study CSRF header is missing', async () => {
    const response = await request(app)
      .post('/study/imports')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', csrfCookies)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Invalid CSRF token');
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('sanitizes media filenames used in the Content-Disposition header', async () => {
    const audioPath = path.join(temporaryDirectory, 'study-audio.mp3');
    await writeFile(audioPath, Buffer.from('audio-data'));
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'local',
      absolutePath: audioPath,
      contentType: 'audio/mpeg',
      contentDisposition: 'inline',
      filename: "evil\"; filename*=utf-8''oops.mp3",
    });

    const response = await request(app).get('/study/media/media-1');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, max-age=15552000, immutable');
    expect(response.headers['content-disposition']).toBe(
      'inline; filename="evil___filename__utf-8__oops.mp3"'
    );
  });

  it('forces attachment disposition for unsafe study media types', async () => {
    const svgPath = path.join(temporaryDirectory, 'study-image.svg');
    await writeFile(svgPath, Buffer.from('<svg />'));
    getStudyMediaAccessMock.mockResolvedValue({
      type: 'local',
      absolutePath: svgPath,
      contentType: 'image/svg+xml',
      contentDisposition: 'attachment',
      filename: 'diagram.svg',
    });

    const response = await request(app).get('/study/media/media-svg');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe('attachment; filename="diagram.svg"');
  });
});
