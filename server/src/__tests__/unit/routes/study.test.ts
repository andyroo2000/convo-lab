import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
  execMock,
  createStudyCardMock,
  expireAtMock,
  exportStudyCardsSectionMock,
  exportStudyImportsSectionMock,
  exportStudyMediaSectionMock,
  exportStudyReviewLogsSectionMock,
  getStudyCardOptionsMock,
  getStudyBrowserListMock,
  getStudyBrowserNoteDetailMock,
  getStudyHistoryMock,
  getCurrentStudyImportJobMock,
  getStudyNewCardQueueMock,
  getStudyMediaAccessMock,
  getStudyImportUploadReadinessMock,
  getStudySettingsMock,
  multiMock,
  performStudyCardActionMock,
  prepareStudyCardAnswerAudioMock,
  recordStudyReviewMock,
  reorderStudyNewCardQueueMock,
  startStudySessionMock,
  undoStudyReviewMock,
  updateStudySettingsMock,
  updateStudyCardMock,
} = vi.hoisted(() => ({
  cancelStudyImportUploadMock: vi.fn(),
  completeStudyImportUploadMock: vi.fn(),
  createStudyImportUploadSessionMock: vi.fn(),
  createRedisConnectionMock: vi.fn(),
  execMock: vi.fn(),
  createStudyCardMock: vi.fn(),
  expireAtMock: vi.fn(),
  exportStudyCardsSectionMock: vi.fn(),
  exportStudyImportsSectionMock: vi.fn(),
  exportStudyMediaSectionMock: vi.fn(),
  exportStudyReviewLogsSectionMock: vi.fn(),
  getStudyCardOptionsMock: vi.fn(),
  getStudyBrowserListMock: vi.fn(),
  getStudyBrowserNoteDetailMock: vi.fn(),
  getStudyHistoryMock: vi.fn(),
  getCurrentStudyImportJobMock: vi.fn(),
  getStudyNewCardQueueMock: vi.fn(),
  getStudyMediaAccessMock: vi.fn(),
  getStudyImportUploadReadinessMock: vi.fn(),
  getStudySettingsMock: vi.fn(),
  multiMock: vi.fn(),
  performStudyCardActionMock: vi.fn(),
  prepareStudyCardAnswerAudioMock: vi.fn(),
  recordStudyReviewMock: vi.fn(),
  reorderStudyNewCardQueueMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudySettingsMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
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
  createStudyCard: createStudyCardMock,
  createStudyImportUploadSession: createStudyImportUploadSessionMock,
  exportStudyData: vi.fn(),
  exportStudyCardsSection: exportStudyCardsSectionMock,
  exportStudyImportsSection: exportStudyImportsSectionMock,
  exportStudyMediaSection: exportStudyMediaSectionMock,
  exportStudyReviewLogsSection: exportStudyReviewLogsSectionMock,
  getStudyBrowserList: getStudyBrowserListMock,
  getStudyBrowserNoteDetail: getStudyBrowserNoteDetailMock,
  getStudyCardOptions: getStudyCardOptionsMock,
  getStudyHistory: getStudyHistoryMock,
  getCurrentStudyImportJob: getCurrentStudyImportJobMock,
  getStudyNewCardQueue: getStudyNewCardQueueMock,
  getStudyMediaAccess: getStudyMediaAccessMock,
  getStudyImportJob: vi.fn(),
  getStudyImportUploadReadiness: getStudyImportUploadReadinessMock,
  getStudyOverview: vi.fn(),
  getStudySettings: getStudySettingsMock,
  performStudyCardAction: performStudyCardActionMock,
  prepareStudyCardAnswerAudio: prepareStudyCardAnswerAudioMock,
  recordStudyReview: recordStudyReviewMock,
  reorderStudyNewCardQueue: reorderStudyNewCardQueueMock,
  startStudySession: startStudySessionMock,
  undoStudyReview: undoStudyReviewMock,
  updateStudySettings: updateStudySettingsMock,
  updateStudyCard: updateStudyCardMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
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
    createStudyImportUploadSessionMock.mockReset();
    completeStudyImportUploadMock.mockReset();
    undoStudyReviewMock.mockReset();
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
    getStudyHistoryMock.mockResolvedValue({
      events: [],
      nextCursor: null,
    });
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
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const module = await import('../../../routes/study.js');
    studyRouter = module.default;
    app.use('/study', studyRouter);
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

  it('starts study sessions without trusting client-provided batch sizes', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 1,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [],
    });

    const response = await withMutationCsrf(request(app).post('/study/session/start')).send({
      limit: 999,
    });

    expect(response.status).toBe(200);
    expect(startStudySessionMock).toHaveBeenCalledWith('user-1', { timeZone: undefined });
  });

  it('passes a valid device timezone when starting study sessions', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 1,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [],
    });

    const response = await withMutationCsrf(request(app).post('/study/session/start')).send({
      timeZone: 'America/New_York',
    });

    expect(response.status).toBe(200);
    expect(startStudySessionMock).toHaveBeenCalledWith('user-1', {
      timeZone: 'America/New_York',
    });
  });

  it('reads and updates study settings', async () => {
    getStudySettingsMock.mockResolvedValue({ newCardsPerDay: 20 });
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 12 });

    const getResponse = await request(app).get('/study/settings');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ newCardsPerDay: 20 });
    expect(multiMock).toHaveBeenCalledTimes(1);

    const patchResponse = await withMutationCsrf(request(app).patch('/study/settings')).send({
      newCardsPerDay: 12,
    });
    expect(patchResponse.status).toBe(200);
    expect(multiMock).toHaveBeenCalledTimes(2);
    expect(updateStudySettingsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      newCardsPerDay: 12,
    });
  });

  it('lets the study settings service own daily-limit validation', async () => {
    const validationError = Object.assign(
      new Error('newCardsPerDay must be an integer between 0 and 1000.'),
      { statusCode: 400 }
    );
    updateStudySettingsMock.mockRejectedValue(validationError);

    const response = await withMutationCsrf(request(app).patch('/study/settings')).send({
      newCardsPerDay: 1001,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('newCardsPerDay must be an integer');
    expect(updateStudySettingsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      newCardsPerDay: 1001,
    });
  });

  it('lists and reorders the new-card queue', async () => {
    getStudyNewCardQueueMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      nextCursor: null,
    });
    reorderStudyNewCardQueueMock.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      nextCursor: null,
    });

    const listResponse = await request(app).get('/study/new-queue?q=会社');
    expect(listResponse.status).toBe(200);
    expect(multiMock).toHaveBeenCalledTimes(1);
    expect(getStudyNewCardQueueMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: 100,
      q: '会社',
    });

    const reorderResponse = await withMutationCsrf(
      request(app).post('/study/new-queue/reorder')
    ).send({
      cardIds: ['card-2', 'card-1'],
    });
    expect(reorderResponse.status).toBe(200);
    expect(reorderStudyNewCardQueueMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardIds: ['card-2', 'card-1'],
    });
  });

  it('rejects malformed reorder card ids before calling the service', async () => {
    const response = await withMutationCsrf(request(app).post('/study/new-queue/reorder')).send({
      cardIds: ['card-1', ''],
    });

    expect(response.status).toBe(400);
    expect(reorderStudyNewCardQueueMock).not.toHaveBeenCalled();
  });

  it('lets the study scheduler service own reorder length validation', async () => {
    const validationError = Object.assign(
      new Error('cardIds must include between 1 and 500 cards.'),
      {
        statusCode: 400,
      }
    );
    reorderStudyNewCardQueueMock.mockRejectedValue(validationError);
    const cardIds = Array.from({ length: 501 }, (_, index) => `card-${index + 1}`);

    const response = await withMutationCsrf(request(app).post('/study/new-queue/reorder')).send({
      cardIds,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('cardIds must include');
    expect(reorderStudyNewCardQueueMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardIds,
    });
  });

  it('rejects invalid review grades', async () => {
    const response = await withMutationCsrf(request(app).post('/study/reviews')).send({
      cardId: 'card-1',
      grade: 'nope',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('grade must be again, hard, good, or easy');
    expect(recordStudyReviewMock).not.toHaveBeenCalled();
  });

  it('clamps review durationMs to a safe upper bound before calling the service', async () => {
    recordStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: { id: 'card-1' },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    const response = await withMutationCsrf(request(app).post('/study/reviews')).send({
      cardId: 'card-1',
      grade: 'good',
      durationMs: Number.MAX_SAFE_INTEGER,
    });

    expect(response.status).toBe(200);
    expect(recordStudyReviewMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardId: 'card-1',
      grade: 'good',
      durationMs: 3_600_000,
      timeZone: undefined,
      currentOverview: undefined,
    });
  });

  it('passes timezone through when undoing a study review', async () => {
    undoStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: { id: 'card-1' },
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    const response = await withMutationCsrf(request(app).post('/study/reviews/undo')).send({
      reviewLogId: 'review-log-1',
      timeZone: 'America/New_York',
    });

    expect(response.status).toBe(200);
    expect(undoStudyReviewMock).toHaveBeenCalledWith({
      userId: 'user-1',
      reviewLogId: 'review-log-1',
      timeZone: 'America/New_York',
      currentOverview: undefined,
    });
  });

  it('rejects invalid undo timezones before calling the service', async () => {
    const response = await withMutationCsrf(request(app).post('/study/reviews/undo')).send({
      reviewLogId: 'review-log-1',
      timeZone: 'Not/AZone',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('timeZone must be a valid IANA timezone');
    expect(undoStudyReviewMock).not.toHaveBeenCalled();
  });

  it('rejects invalid edit payloads', async () => {
    const response = await withMutationCsrf(request(app).patch('/study/cards/card-1')).send({
      prompt: 'bad',
      answer: null,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('prompt and answer payloads are required');
    expect(updateStudyCardMock).not.toHaveBeenCalled();
  });

  it('rejects create payloads with unsupported prompt fields', async () => {
    const response = await withMutationCsrf(request(app).post('/study/cards')).send({
      cardType: 'recognition',
      prompt: { cueText: '会社', unexpected: 'nope' },
      answer: { meaning: 'company' },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('prompt contains unsupported field');
    expect(createStudyCardMock).not.toHaveBeenCalled();
  });

  it('rejects update payloads with invalid media refs', async () => {
    const response = await withMutationCsrf(request(app).patch('/study/cards/card-1')).send({
      prompt: {
        cueAudio: {
          filename: 'audio.mp3',
          mediaKind: 'bad',
          source: 'generated',
        },
      },
      answer: { meaning: 'company' },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      'prompt.cueAudio.mediaKind must be audio, image, or other'
    );
    expect(updateStudyCardMock).not.toHaveBeenCalled();
  });

  it('rejects oversized create payloads before hitting the service', async () => {
    const response = await withMutationCsrf(request(app).post('/study/cards')).send({
      cardType: 'recognition',
      prompt: { cueText: 'a'.repeat(70 * 1024) },
      answer: { meaning: 'company' },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('64 KB or smaller');
    expect(createStudyCardMock).not.toHaveBeenCalled();
  });

  it('rejects overly deep update payloads before hitting the service', async () => {
    const tooDeepPrompt = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: 'too deep',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const response = await withMutationCsrf(request(app).patch('/study/cards/card-1')).send({
      prompt: tooDeepPrompt,
      answer: { meaning: 'company' },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('8 levels deep or fewer');
    expect(updateStudyCardMock).not.toHaveBeenCalled();
  });

  it('passes card actions through to the service', async () => {
    performStudyCardActionMock.mockResolvedValue({
      card: { id: 'card-1' },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 1,
        totalCards: 1,
      },
    });

    const response = await withMutationCsrf(request(app).post('/study/cards/card-1/actions')).send({
      action: 'set_due',
      mode: 'tomorrow',
      timeZone: 'America/New_York',
    });

    expect(response.status).toBe(200);
    expect(performStudyCardActionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'set_due',
      mode: 'tomorrow',
      dueAt: undefined,
      timeZone: 'America/New_York',
    });
  });

  it('rejects set_due tomorrow without a valid timezone', async () => {
    const response = await withMutationCsrf(request(app).post('/study/cards/card-1/actions')).send({
      action: 'set_due',
      mode: 'tomorrow',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('timeZone must be a valid IANA timezone');
    expect(performStudyCardActionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid set_due payloads', async () => {
    const response = await withMutationCsrf(request(app).post('/study/cards/card-1/actions')).send({
      action: 'set_due',
      mode: 'custom_date',
      dueAt: 'bad-date',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('dueAt must be a valid ISO-8601 datetime');
    expect(performStudyCardActionMock).not.toHaveBeenCalled();
  });

  it('rejects set_due custom dates more than 10 years in the future', async () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 11);

    const response = await withMutationCsrf(request(app).post('/study/cards/card-1/actions')).send({
      action: 'set_due',
      mode: 'custom_date',
      dueAt: farFuture.toISOString(),
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('within 10 years');
    expect(performStudyCardActionMock).not.toHaveBeenCalled();
  });

  it('passes browser list query params through to the service', async () => {
    getStudyBrowserListMock.mockResolvedValue({
      rows: [],
      total: 0,
      limit: 25,
      nextCursor: 'cursor-2',
      filterOptions: {
        noteTypes: [],
        cardTypes: [],
        queueStates: [],
      },
    });

    const response = await request(app).get(
      '/study/browser?q=%E4%BC%9A%E7%A4%BE&noteType=Japanese%20-%20Vocab&cardType=recognition&queueState=review&cursor=cursor-1&limit=25'
    );

    expect(response.status).toBe(200);
    expect(getStudyBrowserListMock).toHaveBeenCalledWith({
      userId: 'user-1',
      q: '会社',
      noteType: 'Japanese - Vocab',
      cardType: 'recognition',
      queueState: 'review',
      cursor: 'cursor-1',
      limit: 25,
    });
  });

  it('rejects browser queries longer than 200 characters', async () => {
    const response = await request(app).get(`/study/browser?q=${'あ'.repeat(201)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('200 characters or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects browser cursors longer than 1000 characters', async () => {
    const response = await request(app).get(`/study/browser?cursor=${'a'.repeat(1001)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('cursor must be 1000 characters or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects browser noteType values longer than 200 characters', async () => {
    const response = await request(app).get(`/study/browser?noteType=${'a'.repeat(201)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('noteType must be 200 characters or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects invalid browser limit values', async () => {
    const response = await request(app).get('/study/browser?limit=0');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('limit must be a positive integer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects browser limits larger than 100', async () => {
    const response = await request(app).get('/study/browser?limit=101');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('limit must be 100 or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects non-numeric browser limit values', async () => {
    const response = await request(app).get('/study/browser?limit=abc');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('limit must be a positive integer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('returns 404 when a browser note detail is missing', async () => {
    getStudyBrowserNoteDetailMock.mockResolvedValue(null);

    const response = await request(app).get('/study/browser/missing-note');

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Study note not found');
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

  it('returns lightweight card options for the history filter', async () => {
    getStudyCardOptionsMock.mockResolvedValue({
      total: 125,
      options: [{ id: 'card-1', label: '会社' }],
    });

    const response = await request(app).get('/study/cards/options?limit=100');

    expect(response.status).toBe(200);
    expect(getStudyCardOptionsMock).toHaveBeenCalledWith('user-1', 100);
    expect(response.body.total).toBe(125);
  });

  it('rejects card options limits above the route maximum', async () => {
    const response = await request(app).get('/study/cards/options?limit=500');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('limit must be 100 or fewer');
    expect(getStudyCardOptionsMock).not.toHaveBeenCalled();
  });

  it('passes history cursor pagination params through to the service', async () => {
    const response = await request(app).get(
      '/study/history?cardId=card-1&cursor=cursor-1&limit=25'
    );

    expect(response.status).toBe(200);
    expect(getStudyHistoryMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardId: 'card-1',
      cursor: 'cursor-1',
      limit: 25,
    });
  });

  it('rejects history cursors longer than 1000 characters', async () => {
    const response = await request(app).get(`/study/history?cursor=${'a'.repeat(1001)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('cursor must be 1000 characters or fewer');
    expect(getStudyHistoryMock).not.toHaveBeenCalled();
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
      audioCourseEnabled: true,
      flashcardsEnabled: false,
    });

    const response = await request(app).get('/study/browser');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('blocks study routes when the flashcards feature flag row is missing', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

    const response = await request(app).get('/study/browser');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not enabled');
  });

  it('blocks study mutation routes for cross-origin requests', async () => {
    const response = await withMutationCsrf(
      request(app).post('/study/session/start'),
      'https://evil.example.com'
    ).send({ limit: 10 });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Invalid request origin');
    expect(startStudySessionMock).not.toHaveBeenCalled();
  });

  it('allows read-only study routes without same-origin mutation headers', async () => {
    getStudyBrowserListMock.mockResolvedValue({
      rows: [],
      total: 0,
      limit: 100,
      nextCursor: null,
      filterOptions: {
        noteTypes: [],
        cardTypes: [],
        queueStates: [],
      },
    });

    const response = await request(app).get('/study/browser');

    expect(response.status).toBe(200);
    expect(getStudyBrowserListMock).toHaveBeenCalled();
  });

  it('defaults browser cursor pagination when cursor and limit are omitted', async () => {
    getStudyBrowserListMock.mockResolvedValue({
      rows: [],
      total: 0,
      limit: 100,
      nextCursor: null,
      filterOptions: {
        noteTypes: [],
        cardTypes: [],
        queueStates: [],
      },
    });

    const response = await request(app).get('/study/browser');

    expect(response.status).toBe(200);
    expect(getStudyBrowserListMock).toHaveBeenCalledWith({
      userId: 'user-1',
      q: undefined,
      noteType: undefined,
      cardType: undefined,
      queueState: undefined,
      cursor: undefined,
      limit: 100,
    });
  });

  it('rejects mutation requests when Origin is absent', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [],
    });

    const response = await withMutationCsrf(
      request(app).post('/study/session/start'),
      'https://evil.example.com'
    ).send({ limit: 10 });

    expect(response.status).toBe(403);
    expect(startStudySessionMock).not.toHaveBeenCalled();
  });

  it('rejects mutation requests when the study CSRF header is missing', async () => {
    const response = await request(app)
      .post('/study/session/start')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', csrfCookies)
      .send({ limit: 10 });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Invalid CSRF token');
    expect(startStudySessionMock).not.toHaveBeenCalled();
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
