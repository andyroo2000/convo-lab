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

import { mockPrisma } from '../../setup.js';

const {
  createRedisConnectionMock,
  createStudyCardMock,
  expireMock,
  getStudyCardOptionsMock,
  getStudyBrowserListMock,
  getStudyBrowserNoteDetailMock,
  importJapaneseStudyColpkgMock,
  incrMock,
  performStudyCardActionMock,
  prepareStudyCardAnswerAudioMock,
  recordStudyReviewMock,
  startStudySessionMock,
  updateStudyCardMock,
} = vi.hoisted(() => ({
  createRedisConnectionMock: vi.fn(),
  createStudyCardMock: vi.fn(),
  expireMock: vi.fn(),
  getStudyCardOptionsMock: vi.fn(),
  getStudyBrowserListMock: vi.fn(),
  getStudyBrowserNoteDetailMock: vi.fn(),
  importJapaneseStudyColpkgMock: vi.fn(),
  incrMock: vi.fn(),
  performStudyCardActionMock: vi.fn(),
  prepareStudyCardAnswerAudioMock: vi.fn(),
  recordStudyReviewMock: vi.fn(),
  startStudySessionMock: vi.fn(),
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
  createStudyCard: createStudyCardMock,
  exportStudyData: vi.fn(),
  getStudyBrowserList: getStudyBrowserListMock,
  getStudyBrowserNoteDetail: getStudyBrowserNoteDetailMock,
  getStudyCardOptions: getStudyCardOptionsMock,
  getStudyHistory: vi.fn(),
  getStudyImportJob: vi.fn(),
  getStudyOverview: vi.fn(),
  importJapaneseStudyColpkg: importJapaneseStudyColpkgMock,
  performStudyCardAction: performStudyCardActionMock,
  prepareStudyCardAnswerAudio: prepareStudyCardAnswerAudioMock,
  recordStudyReview: recordStudyReviewMock,
  startStudySession: startStudySessionMock,
  undoStudyReview: vi.fn(),
  updateStudyCard: updateStudyCardMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
}));

describe('Study Routes', () => {
  let app: express.Application;
  let studyRouter: Router;
  let testClockOffset = 0;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    incrMock.mockReset();
    expireMock.mockReset();
    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(1);
    createRedisConnectionMock.mockReset();
    createRedisConnectionMock.mockReturnValue({
      incr: incrMock,
      expire: expireMock,
    });
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(`2026-04-21T${String(12 + testClockOffset).padStart(2, '0')}:00:00.000Z`)
    );
    testClockOffset += 1;
    app = express();
    app.use(expressJson());
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const module = await import('../../../routes/study.js');
    studyRouter = module.default;
    app.use('/study', studyRouter);
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clamps study session start limits to 200', async () => {
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

    const response = await request(app).post('/study/session/start').send({ limit: 999 });

    expect(response.status).toBe(200);
    expect(startStudySessionMock).toHaveBeenCalledWith('user-1', 200);
  });

  it('rejects invalid review grades', async () => {
    const response = await request(app)
      .post('/study/reviews')
      .send({ cardId: 'card-1', grade: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('grade must be again, hard, good, or easy');
    expect(recordStudyReviewMock).not.toHaveBeenCalled();
  });

  it('rejects invalid edit payloads', async () => {
    const response = await request(app)
      .patch('/study/cards/card-1')
      .send({ prompt: 'bad', answer: null });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('prompt and answer payloads are required');
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

    const response = await request(app)
      .post('/study/cards/card-1/actions')
      .send({ action: 'set_due', mode: 'tomorrow' });

    expect(response.status).toBe(200);
    expect(performStudyCardActionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'set_due',
      mode: 'tomorrow',
      dueAt: undefined,
    });
  });

  it('rejects invalid set_due payloads', async () => {
    const response = await request(app)
      .post('/study/cards/card-1/actions')
      .send({ action: 'set_due', mode: 'custom_date', dueAt: 'bad-date' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('dueAt must be a valid ISO date');
    expect(performStudyCardActionMock).not.toHaveBeenCalled();
  });

  it('passes browser list query params through to the service', async () => {
    getStudyBrowserListMock.mockResolvedValue({
      rows: [],
      total: 0,
      page: 2,
      pageSize: 25,
      filterOptions: {
        noteTypes: [],
        cardTypes: [],
        queueStates: [],
      },
    });

    const response = await request(app).get(
      '/study/browser?q=%E4%BC%9A%E7%A4%BE&noteType=Japanese%20-%20Vocab&cardType=recognition&queueState=review&page=2&pageSize=25'
    );

    expect(response.status).toBe(200);
    expect(getStudyBrowserListMock).toHaveBeenCalledWith({
      userId: 'user-1',
      q: '会社',
      noteType: 'Japanese - Vocab',
      cardType: 'recognition',
      queueState: 'review',
      page: 2,
      pageSize: 25,
    });
  });

  it('rejects browser queries longer than 200 characters', async () => {
    const response = await request(app).get(`/study/browser?q=${'あ'.repeat(201)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('200 characters or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects invalid browser page values', async () => {
    const response = await request(app).get('/study/browser?page=0');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('page must be a positive integer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects invalid browser pageSize values', async () => {
    const response = await request(app).get('/study/browser?pageSize=101');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('pageSize must be 100 or fewer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('rejects non-numeric browser page values', async () => {
    const response = await request(app).get('/study/browser?page=abc');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('page must be a positive integer');
    expect(getStudyBrowserListMock).not.toHaveBeenCalled();
  });

  it('returns 404 when a browser note detail is missing', async () => {
    getStudyBrowserNoteDetailMock.mockResolvedValue(null);

    const response = await request(app).get('/study/browser/missing-note');

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Study note not found');
  });

  it('rejects non-.colpkg uploads before import processing', async () => {
    const response = await request(app)
      .post('/study/imports')
      .attach('file', Buffer.from('not-a-colpkg'), 'anki-export.txt');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Only .colpkg Anki collection backups are accepted');
    expect(importJapaneseStudyColpkgMock).not.toHaveBeenCalled();
  });

  it('returns lightweight card options for the history filter', async () => {
    getStudyCardOptionsMock.mockResolvedValue({
      total: 125,
      options: [{ id: 'card-1', label: '会社' }],
    });

    const response = await request(app).get('/study/cards/options?limit=500');

    expect(response.status).toBe(200);
    expect(getStudyCardOptionsMock).toHaveBeenCalledWith('user-1', 100);
    expect(response.body.total).toBe(125);
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
});
