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
  rateLimitStudyRoute:
    (options: { allowAnonymousIdentity?: boolean }) =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (!(req as Request & { userId?: string }).userId && !options.allowAnonymousIdentity) {
        const error = new Error('Authentication required') as Error & { statusCode: number };
        error.statusCode = 401;
        next(error);
        return;
      }
      next();
    },
}));

const PRACTICE_ID = '106b92e8-53c9-4e9e-8046-32feca98b8e4';

function createApp() {
  const app = express();
  app.use(expressJson());
  app.use('/api/daily-audio-practice', dailyAudioPracticeRoutes);
  app.use(
    (err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  );
  return app;
}

function makeTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'track-1',
    practiceId: PRACTICE_ID,
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
    id: PRACTICE_ID,
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
      id: PRACTICE_ID,
      status: 'generating',
      practiceDate: '2026-05-05',
    });
    expect(mockPrisma.dailyAudioPracticeTrack.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          practiceId: PRACTICE_ID,
          mode: { in: ['drill'] },
        },
        data: expect.objectContaining({
          status: 'draft',
          errorMessage: null,
        }),
      })
    );
    expect(mockPrisma.dailyAudioPracticeTrack.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          practiceId: PRACTICE_ID,
          mode: { in: ['dialogue', 'story'] },
        },
        data: expect.objectContaining({
          status: 'skipped',
          errorMessage: null,
        }),
      })
    );
    expect(enqueueDailyAudioPracticeJobMock).toHaveBeenCalledWith(PRACTICE_ID);
  });

  it('regenerates an existing ready set when requested again', async () => {
    mockPrisma.dailyAudioPractice.upsert.mockResolvedValue(makePractice({ status: 'ready' }));
    mockPrisma.dailyAudioPractice.findUniqueOrThrow.mockResolvedValue(
      makePractice({
        status: 'generating',
        tracks: [
          makeTrack({ status: 'draft', audioUrl: null }),
          makeTrack({ id: 'track-2', mode: 'dialogue', status: 'skipped', audioUrl: null }),
          makeTrack({ id: 'track-3', mode: 'story', status: 'skipped', audioUrl: null }),
        ],
      })
    );

    const response = await request(createApp())
      .post('/api/daily-audio-practice')
      .send({ timeZone: 'America/New_York' })
      .expect(202);

    expect(response.body.status).toBe('generating');
    expect(response.body.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'dialogue', status: 'skipped' }),
        expect.objectContaining({ mode: 'story', status: 'skipped' }),
      ])
    );
    expect(enqueueDailyAudioPracticeJobMock).toHaveBeenCalledWith(PRACTICE_ID);
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

    expect(enqueueDailyAudioPracticeJobMock).toHaveBeenCalledWith(PRACTICE_ID);
    expect(mockPrisma.dailyAudioPractice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'error',
          errorMessage: 'Daily Audio Practice could not be queued. Please try again.',
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
      .get(`/api/daily-audio-practice/${PRACTICE_ID}/status`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: PRACTICE_ID,
      status: 'generating',
      progress: 45,
    });
  });

  it('rejects malformed practice ids before querying', async () => {
    const response = await request(createApp())
      .get('/api/daily-audio-practice/not-a-practice/status')
      .expect(404);

    expect(response.body.error).toBe('Daily Audio Practice not found.');
    expect(mockPrisma.dailyAudioPractice.findFirst).not.toHaveBeenCalled();
  });

  it('lists recent practice sets', async () => {
    mockPrisma.dailyAudioPractice.findMany.mockResolvedValue([
      makePractice({ id: PRACTICE_ID }),
      makePractice({ id: 'practice-2', practiceDate: new Date('2026-05-04T00:00:00.000Z') }),
    ]);

    const response = await request(createApp()).get('/api/daily-audio-practice').expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].tracks[0]).not.toHaveProperty('scriptUnitsJson');
    expect(response.body[0].tracks[0]).not.toHaveProperty('timingData');
    expect(mockPrisma.dailyAudioPractice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        include: {
          tracks: {
            select: expect.not.objectContaining({
              scriptUnitsJson: true,
              timingData: true,
              generationMetadataJson: true,
            }),
          },
        },
        take: 14,
      })
    );
  });
});
