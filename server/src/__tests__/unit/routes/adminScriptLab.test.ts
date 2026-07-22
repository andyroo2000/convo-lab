import express, {
  json as expressJson,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';
import adminScriptLabRouter from '../../../routes/adminScriptLab.js';

const mocks = vi.hoisted(() => ({
  createCourse: vi.fn(),
  listCourses: vi.fn(),
  showCourse: vi.fn(),
  deleteCourses: vi.fn(),
  generateSentence: vi.fn(),
  listSentenceTests: vi.fn(),
  showSentenceTest: vi.fn(),
  deleteSentenceTests: vi.fn(),
  testPronunciation: vi.fn(),
  synthesizeLine: vi.fn(),
  streamAudio: vi.fn(),
}));

vi.mock('../../../routes/learningOs/admin.js', () => ({
  createLearningOsAdminScriptLabCourse: mocks.createCourse,
  listLearningOsAdminScriptLabCourses: mocks.listCourses,
  showLearningOsAdminScriptLabCourse: mocks.showCourse,
  deleteLearningOsAdminScriptLabCourses: mocks.deleteCourses,
  generateLearningOsAdminSentenceScript: mocks.generateSentence,
  listLearningOsAdminSentenceScriptTests: mocks.listSentenceTests,
  showLearningOsAdminSentenceScriptTest: mocks.showSentenceTest,
  deleteLearningOsAdminSentenceScriptTests: mocks.deleteSentenceTests,
  testLearningOsAdminPronunciation: mocks.testPronunciation,
  synthesizeLearningOsAdminScriptLabLine: mocks.synthesizeLine,
  streamLearningOsAdminScriptLabAudio: mocks.streamAudio,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
    req.userId = '11111111-1111-4111-8111-111111111111';
    next();
  },
  AuthRequest: class {},
}));
vi.mock('../../../middleware/roleAuth.js', () => ({
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireRole: (_role: string) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
describe('Admin Script Lab routing', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const [name, handler] of Object.entries(mocks)) {
      handler.mockImplementation((_req: Request, res: Response) => res.json({ handler: name }));
    }

    app = express();
    app.use(expressJson());
    app.use('/api/admin/script-lab', adminScriptLabRouter);
    app.use(errorHandler);
  });

  it.each([
    ['POST', '/api/admin/script-lab/sentence-script', 'generateSentence'],
    ['GET', '/api/admin/script-lab/sentence-tests', 'listSentenceTests'],
    [
      'GET',
      '/api/admin/script-lab/sentence-tests/66666666-6666-4666-8666-666666666666',
      'showSentenceTest',
    ],
    ['DELETE', '/api/admin/script-lab/sentence-tests', 'deleteSentenceTests'],
    ['POST', '/api/admin/script-lab/test-pronunciation', 'testPronunciation'],
    ['POST', '/api/admin/script-lab/synthesize-line', 'synthesizeLine'],
    ['GET', '/api/admin/script-lab/audio/77777777-7777-4777-8777-777777777777', 'streamAudio'],
  ] as const)('routes %s %s through the Learning OS proxy', async (method, path, handler) => {
    const pending =
      method === 'POST'
        ? request(app).post(path).send({ sentence: '東京' })
        : method === 'DELETE'
          ? request(app).delete(path).send({ ids: [] })
          : request(app).get(path);

    await pending.expect(200, { handler });
    expect(mocks[handler]).toHaveBeenCalledOnce();
  });
});
