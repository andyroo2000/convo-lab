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
  approveMonologueScriptMock,
  createMonologueProjectMock,
  generateMonologueSegmentAudioTakeMock,
  getMonologueProjectMock,
  listMonologueProjectsMock,
  setMonologueDefaultAudioTakeMock,
} = vi.hoisted(() => ({
  approveMonologueScriptMock: vi.fn(),
  createMonologueProjectMock: vi.fn(),
  generateMonologueSegmentAudioTakeMock: vi.fn(),
  getMonologueProjectMock: vi.fn(),
  listMonologueProjectsMock: vi.fn(),
  setMonologueDefaultAudioTakeMock: vi.fn(),
}));

vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../services/monologueService.js', () => ({
  approveMonologueScript: approveMonologueScriptMock,
  createMonologueProject: createMonologueProjectMock,
  generateMonologueFullAudioTake: vi.fn(),
  generateMonologueSegmentAudioTake: generateMonologueSegmentAudioTakeMock,
  getMonologueProject: getMonologueProjectMock,
  listMonologueProjects: listMonologueProjectsMock,
  regenerateMonologueAudioTake: vi.fn(),
  setMonologueDefaultAudioTake: setMonologueDefaultAudioTakeMock,
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
    listMonologueProjectsMock.mockResolvedValue([]);
  });

  it('creates a monologue project from source text', async () => {
    createMonologueProjectMock.mockResolvedValue({
      id: 'project-1',
      title: 'Tokyo story',
      sourceText: 'English source',
    });

    const response = await request(app)
      .post('/api/study/monologues')
      .send({ title: 'Tokyo story', sourceText: 'English source' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'project-1',
      title: 'Tokyo story',
      sourceText: 'English source',
    });
    expect(createMonologueProjectMock).toHaveBeenCalledWith('user-1', {
      title: 'Tokyo story',
      sourceText: 'English source',
    });
  });

  it('returns a monologue project by id', async () => {
    getMonologueProjectMock.mockResolvedValue({
      id: 'project-1',
      title: 'Tokyo story',
    });

    const response = await request(app).get('/api/study/monologues/project-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      title: 'Tokyo story',
    });
    expect(getMonologueProjectMock).toHaveBeenCalledWith('user-1', 'project-1');
  });

  it('approves a monologue project script', async () => {
    approveMonologueScriptMock.mockResolvedValue({
      id: 'project-1',
      status: 'approved',
    });

    const response = await request(app).post('/api/study/monologues/project-1/approve');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'approved',
    });
    expect(approveMonologueScriptMock).toHaveBeenCalledWith('user-1', 'project-1');
  });

  it('generates a sentence audio take', async () => {
    generateMonologueSegmentAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'ready',
    });

    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ voiceId: 'ja-JP-Neural2-D', speed: 0.85, displayName: 'Daichi slow' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'ready',
    });
    expect(generateMonologueSegmentAudioTakeMock).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'segment-1',
      {
        displayName: 'Daichi slow',
        isDefault: undefined,
        speed: 0.85,
        voiceId: 'ja-JP-Neural2-D',
      }
    );
  });

  it('treats null audio speed as omitted', async () => {
    generateMonologueSegmentAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'ready',
    });

    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ voiceId: 'fish-ren', speed: null });

    expect(response.status).toBe(201);
    expect(generateMonologueSegmentAudioTakeMock).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'segment-1',
      expect.objectContaining({ speed: undefined, voiceId: 'fish-ren' })
    );
  });

  it('sets a default audio take', async () => {
    setMonologueDefaultAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'ready',
    });

    const response = await request(app).post(
      '/api/study/monologues/project-1/audio-takes/take-1/default'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'ready',
    });
    expect(setMonologueDefaultAudioTakeMock).toHaveBeenCalledWith('user-1', 'project-1', 'take-1');
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
