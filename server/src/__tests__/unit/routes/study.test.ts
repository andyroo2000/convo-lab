import express, {
  json as expressJson,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createStudyCardMock,
  getStudyBrowserListMock,
  getStudyBrowserNoteDetailMock,
  prepareStudyCardAnswerAudioMock,
  recordStudyReviewMock,
  startStudySessionMock,
  updateStudyCardMock,
} = vi.hoisted(() => ({
  createStudyCardMock: vi.fn(),
  getStudyBrowserListMock: vi.fn(),
  getStudyBrowserNoteDetailMock: vi.fn(),
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
  getStudyHistory: vi.fn(),
  getStudyImportJob: vi.fn(),
  getStudyOverview: vi.fn(),
  importJapaneseStudyColpkg: vi.fn(),
  prepareStudyCardAnswerAudio: prepareStudyCardAnswerAudioMock,
  recordStudyReview: recordStudyReviewMock,
  startStudySession: startStudySessionMock,
  undoStudyReview: vi.fn(),
  updateStudyCard: updateStudyCardMock,
}));

describe('Study Routes', () => {
  let app: express.Application;
  let studyRouter: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(expressJson());

    const module = await import('../../../routes/study.js');
    studyRouter = module.default;
    app.use('/study', studyRouter);
    app.use(((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message });
    }) as ErrorRequestHandler);
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

  it('returns 404 when a browser note detail is missing', async () => {
    getStudyBrowserNoteDetailMock.mockResolvedValue(null);

    const response = await request(app).get('/study/browser/missing-note');

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Study note not found');
  });
});
