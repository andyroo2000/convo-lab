import express, {
  json as expressJson,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import dailyAudioPracticeRoutes from '../../../routes/dailyAudioPractice.js';
import { mockPrisma } from '../../setup.js';

const { enqueueDailyAudioPracticeJobMock, getJobMock, mockRequestContext, mockFeatureFlags } =
  vi.hoisted(() => ({
    enqueueDailyAudioPracticeJobMock: vi.fn(),
    getJobMock: vi.fn(),
    mockRequestContext: { userId: 'user-1', role: 'user' },
    mockFeatureFlags: { flashcardsEnabled: true },
  }));

vi.mock('../../../jobs/dailyAudioPracticeQueue.js', () => ({
  enqueueDailyAudioPracticeJob: enqueueDailyAudioPracticeJobMock,
  dailyAudioPracticeQueue: {
    getJob: getJobMock,
  },
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { userId: string; role: string }).userId = mockRequestContext.userId;
    (req as Request & { userId: string; role: string }).role = mockRequestContext.role;
    next();
  },
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: (req: Request, _res: Response, next: NextFunction) => {
    if ((req as Request & { role?: string }).role === 'demo') {
      const error = new Error('Demo users cannot create daily audio practice.') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      next(error);
      return;
    }
    next();
  },
}));

vi.mock('../../../middleware/featureFlags.js', () => ({
  requireFeatureFlag:
    (feature: 'flashcardsEnabled') => (_req: Request, _res: Response, next: NextFunction) => {
      if (mockFeatureFlags[feature]) {
        next();
        return;
      }
      const error = new Error('Feature disabled.') as Error & { statusCode: number };
      error.statusCode = 403;
      next(error);
    },
}));

vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

function createApp() {
  const app = express();
  app.use(expressJson());
  app.use('/api/daily-audio-practice', dailyAudioPracticeRoutes);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

function makeTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'track-1',
    practiceId: 'practice-1',
    mode: 'drill',
    status: 'draft',
    title: 'Drills',
    sortOrder: 0,
    scriptUnitsJson: null,
    audioUrl: null,
    timingData: null,
    approxDurationSeconds: null,
    generationMetadataJson: null,
    errorMessage: null,
    createdAt: new Date('2026-05-05T12:00:00.000Z'),
    updatedAt: new Date('2026-05-05T12:00:00.000Z'),
    ...overrides,
  };
}

function makePractice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'practice-1',
    userId: 'user-1',
    practiceDate: new Date('2026-05-05T00:00:00.000Z'),
    status: 'draft',
    targetDurationMinutes: 30,
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    sourceCardIdsJson: null,
    selectionSummaryJson: null,
    errorMessage: null,
    createdAt: new Date('2026-05-05T12:00:00.000Z'),
    updatedAt: new Date('2026-05-05T12:00:00.000Z'),
    tracks: [makeTrack()],
    ...overrides,
  };
}

describe('dailyAudioPractice routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestContext.userId = 'user-1';
    mockRequestContext.role = 'user';
    mockFeatureFlags.flashcardsEnabled = true;
    mockPrisma.user.findUnique.mockResolvedValue({
      preferredStudyLanguage: 'ja',
      preferredNativeLanguage: 'en',
    });
    mockPrisma.dailyAudioPracticeTrack.upsert.mockResolvedValue(makeTrack());
    mockPrisma.dailyAudioPractice.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates today’s practice set and enqueues generation', async () => {
    mockPrisma.dailyAudioPractice.upsert.mockResolvedValue(makePractice());
    mockPrisma.dailyAudioPractice.findUniqueOrThrow.mockResolvedValue(
      makePractice({ status: 'generating' })
    );

    const response = await request(createApp())
      .post('/api/daily-audio-practice')
      .send({ timeZone: 'America/New_York' })
      .expect(202);

    expect(response.body).toMatchObject({
      id: 'practice-1',
      status: 'generating',
      practiceDate: '2026-05-05',
    });
    expect(enqueueDailyAudioPracticeJobMock).toHaveBeenCalledWith('practice-1');
  });

  it('resumes an existing ready set without enqueuing a duplicate job', async () => {
    mockPrisma.dailyAudioPractice.upsert.mockResolvedValue(makePractice({ status: 'ready' }));
    mockPrisma.dailyAudioPractice.findUniqueOrThrow.mockResolvedValue(
      makePractice({
        status: 'ready',
        tracks: [makeTrack({ status: 'ready', audioUrl: '/x.mp3' })],
      })
    );

    const response = await request(createApp())
      .post('/api/daily-audio-practice')
      .send({ timeZone: 'America/New_York' })
      .expect(202);

    expect(response.body.status).toBe('ready');
    expect(enqueueDailyAudioPracticeJobMock).not.toHaveBeenCalled();
  });

  it('restarts an errored set and rolls back status when enqueue fails', async () => {
    mockPrisma.dailyAudioPractice.upsert.mockResolvedValue(makePractice({ status: 'error' }));
    mockPrisma.dailyAudioPractice.update.mockResolvedValue(
      makePractice({ status: 'error', errorMessage: 'Redis unavailable' })
    );
    enqueueDailyAudioPracticeJobMock.mockRejectedValue(new Error('Redis unavailable'));

    await request(createApp())
      .post('/api/daily-audio-practice')
      .send({ timeZone: 'America/New_York' })
      .expect(500);

    expect(enqueueDailyAudioPracticeJobMock).toHaveBeenCalledWith('practice-1');
    expect(mockPrisma.dailyAudioPractice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'error',
          errorMessage: 'Redis unavailable',
        }),
      })
    );
  });

  it('does not enqueue when another request already moved the set to generating', async () => {
    mockPrisma.dailyAudioPractice.upsert.mockResolvedValue(makePractice({ status: 'draft' }));
    mockPrisma.dailyAudioPractice.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.dailyAudioPractice.findUniqueOrThrow.mockResolvedValue(
      makePractice({ status: 'generating' })
    );

    await request(createApp())
      .post('/api/daily-audio-practice')
      .send({ timeZone: 'America/New_York' })
      .expect(202);

    expect(enqueueDailyAudioPracticeJobMock).not.toHaveBeenCalled();
  });

  it('returns queue progress for a generating set', async () => {
    mockPrisma.dailyAudioPractice.findFirst.mockResolvedValue(
      makePractice({ status: 'generating', tracks: [makeTrack({ status: 'ready' })] })
    );
    getJobMock.mockResolvedValue({ progress: 45 });

    const response = await request(createApp())
      .get('/api/daily-audio-practice/practice-1/status')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'practice-1',
      status: 'generating',
      progress: 45,
    });
  });

  it('lists recent practice sets', async () => {
    mockPrisma.dailyAudioPractice.findMany.mockResolvedValue([
      makePractice({ id: 'practice-1' }),
      makePractice({ id: 'practice-2', practiceDate: new Date('2026-05-04T00:00:00.000Z') }),
    ]);

    const response = await request(createApp()).get('/api/daily-audio-practice').expect(200);

    expect(response.body).toHaveLength(2);
    expect(mockPrisma.dailyAudioPractice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 14,
      })
    );
  });
});
