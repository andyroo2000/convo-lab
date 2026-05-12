import express, {
  json as expressJson,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import studyMonologueRoutes from '../../../routes/studyMonologues.js';

const {
  createMonologueProjectMock,
  generateMonologueSegmentAudioTakeMock,
  getMonologueProjectMock,
} = vi.hoisted(() => ({
  createMonologueProjectMock: vi.fn(),
  generateMonologueSegmentAudioTakeMock: vi.fn(),
  getMonologueProjectMock: vi.fn(),
}));

vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../services/monologueService.js', () => ({
  approveMonologueScript: vi.fn(),
  createMonologueProject: createMonologueProjectMock,
  generateMonologueFullAudioTake: vi.fn(),
  generateMonologueSegmentAudioTake: generateMonologueSegmentAudioTakeMock,
  getMonologueProject: getMonologueProjectMock,
  listMonologueProjects: vi.fn().mockResolvedValue([]),
  regenerateMonologueAudioTake: vi.fn(),
  setMonologueDefaultAudioTake: vi.fn(),
  updateMonologueDraft: vi.fn(),
}));

function createApp() {
  const app = express();
  app.use(expressJson());
  app.use((req: Request & { userId?: string }, _res, next) => {
    req.userId = 'user-1';
    next();
  });
  app.use('/api/study/monologues', studyMonologueRoutes);
  app.use(
    (error: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(error.statusCode ?? 500).json({ message: error.message });
    }
  );
  return app;
}

describe('study monologue routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when creating without source text', async () => {
    const response = await request(app).post('/api/study/monologues').send({ sourceText: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'sourceText is required.' });
    expect(createMonologueProjectMock).not.toHaveBeenCalled();
  });

  it('returns 400 when audio generation is missing a voice id', async () => {
    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ speed: 0.85 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'voiceId is required.' });
    expect(generateMonologueSegmentAudioTakeMock).not.toHaveBeenCalled();
  });

  it('returns 400 when audio speed is outside the monologue allowlist', async () => {
    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ voiceId: 'ja-JP-Neural2-D', speed: 0.5 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'speed must be 0.75, 0.85, or 1.' });
    expect(generateMonologueSegmentAudioTakeMock).not.toHaveBeenCalled();
  });

  it('propagates not-found responses from inaccessible projects', async () => {
    const error = Object.assign(new Error('Monologue project not found.'), { statusCode: 404 });
    getMonologueProjectMock.mockRejectedValue(error);

    const response = await request(app).get('/api/study/monologues/project-1');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Monologue project not found.' });
    expect(getMonologueProjectMock).toHaveBeenCalledWith('user-1', 'project-1');
  });
});
