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
  generateMonologueFullAudioTakeMock,
  generateMonologueSegmentAudioTakeMock,
  getMonologueProjectMock,
  listMonologueProjectsMock,
  regenerateMonologueAudioTakeMock,
  setMonologueDefaultAudioTakeMock,
  updateMonologueDraftMock,
} = vi.hoisted(() => ({
  approveMonologueScriptMock: vi.fn(),
  createMonologueProjectMock: vi.fn(),
  generateMonologueFullAudioTakeMock: vi.fn(),
  generateMonologueSegmentAudioTakeMock: vi.fn(),
  getMonologueProjectMock: vi.fn(),
  listMonologueProjectsMock: vi.fn(),
  regenerateMonologueAudioTakeMock: vi.fn(),
  setMonologueDefaultAudioTakeMock: vi.fn(),
  updateMonologueDraftMock: vi.fn(),
}));

vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../services/monologueService.js', () => ({
  approveMonologueScript: approveMonologueScriptMock,
  createMonologueProject: createMonologueProjectMock,
  generateMonologueFullAudioTake: generateMonologueFullAudioTakeMock,
  generateMonologueSegmentAudioTake: generateMonologueSegmentAudioTakeMock,
  getMonologueProject: getMonologueProjectMock,
  listMonologueProjects: listMonologueProjectsMock,
  regenerateMonologueAudioTake: regenerateMonologueAudioTakeMock,
  setMonologueDefaultAudioTake: setMonologueDefaultAudioTakeMock,
  updateMonologueDraft: updateMonologueDraftMock,
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

  it('lists monologue projects', async () => {
    listMonologueProjectsMock.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Tokyo story',
        status: 'draft',
        activeVersionId: 'version-1',
        segmentCount: 3,
        createdAt: '2026-05-12T12:00:00.000Z',
        updatedAt: '2026-05-12T12:00:00.000Z',
      },
    ]);

    const response = await request(app).get('/api/study/monologues');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [
        {
          id: 'project-1',
          title: 'Tokyo story',
          status: 'draft',
          activeVersionId: 'version-1',
          segmentCount: 3,
          createdAt: '2026-05-12T12:00:00.000Z',
          updatedAt: '2026-05-12T12:00:00.000Z',
        },
      ],
    });
    expect(listMonologueProjectsMock).toHaveBeenCalledWith('user-1');
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

  it('updates a monologue draft', async () => {
    updateMonologueDraftMock.mockResolvedValue({
      id: 'project-1',
      status: 'draft',
    });

    const response = await request(app)
      .put('/api/study/monologues/project-1/draft')
      .send({
        title: 'Tokyo return',
        fullText: '日本語です。',
        segments: [
          {
            id: 'segment-1',
            sourceText: 'English cue',
            japaneseText: '日本語です。',
            reading: 'にほんごです。',
            beatLabel: 'Opening',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'draft',
    });
    expect(updateMonologueDraftMock).toHaveBeenCalledWith('user-1', 'project-1', {
      title: 'Tokyo return',
      fullText: '日本語です。',
      segments: [
        {
          id: 'segment-1',
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          reading: 'にほんごです。',
          beatLabel: 'Opening',
        },
      ],
    });
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

  it('regenerates an existing audio take', async () => {
    regenerateMonologueAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'approved',
    });

    const response = await request(app).post(
      '/api/study/monologues/project-1/audio-takes/take-1/regenerate'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'approved',
    });
    expect(regenerateMonologueAudioTakeMock).toHaveBeenCalledWith('user-1', 'project-1', 'take-1');
  });

  it('treats null audio speed as omitted', async () => {
    generateMonologueSegmentAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'ready',
    });

    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ voiceId: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f', speed: null });

    expect(response.status).toBe(201);
    expect(generateMonologueSegmentAudioTakeMock).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'segment-1',
      expect.objectContaining({
        speed: undefined,
        voiceId: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
      })
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

  it('generates full monologue audio', async () => {
    generateMonologueFullAudioTakeMock.mockResolvedValue({
      id: 'project-1',
      status: 'approved',
    });

    const response = await request(app).post('/api/study/monologues/project-1/full-audio');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'project-1',
      status: 'approved',
    });
    expect(generateMonologueFullAudioTakeMock).toHaveBeenCalledWith('user-1', 'project-1');
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

  it('returns 400 when audio generation uses a non-monologue voice id', async () => {
    const response = await request(app)
      .post('/api/study/monologues/project-1/segments/segment-1/audio-takes')
      .send({ voiceId: 'ja-JP-Wavenet-D', speed: 1 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'voiceId is not available for monologues.' });
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
