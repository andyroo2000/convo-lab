import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../db/client.js';
import {
  enqueueDailyAudioPracticeJob,
  dailyAudioPracticeQueue,
} from '../jobs/dailyAudioPracticeQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { DAILY_AUDIO_TRACKS } from '../services/dailyAudioPractice/types.js';

const router = Router();

const DEFAULT_TARGET_DURATION_MINUTES = 30;
const MIN_TARGET_DURATION_MINUTES = 5;
const MAX_TARGET_DURATION_MINUTES = 60;
const limitDailyAudioReads = rateLimitStudyRoute({
  key: 'daily-audio-practice-read',
  max: 240,
  windowMs: 60 * 1000,
});
const authenticateDailyAudioRequest: typeof requireAuth = requireAuth;

router.use(limitDailyAudioReads, authenticateDailyAudioRequest);
router.use(requireFeatureFlag('flashcardsEnabled'));

function parseTargetDurationMinutes(value: unknown): number {
  if (typeof value === 'undefined' || value === null) return DEFAULT_TARGET_DURATION_MINUTES;
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_TARGET_DURATION_MINUTES ||
    parsed > MAX_TARGET_DURATION_MINUTES
  ) {
    throw new AppError('targetDurationMinutes must be an integer from 5 to 60.', 400);
  }
  return parsed;
}

function getLocalPracticeDate(timeZone: unknown): Date {
  const timezone = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC';
  if (timezone.length > 64) {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
  } catch {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new AppError('Unable to derive practice date.', 500);
  }
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function serializePractice(
  practice: Prisma.DailyAudioPracticeGetPayload<{
    include: { tracks: true };
  }>
) {
  return {
    ...practice,
    practiceDate: practice.practiceDate.toISOString().slice(0, 10),
    createdAt: practice.createdAt.toISOString(),
    updatedAt: practice.updatedAt.toISOString(),
    tracks: [...practice.tracks]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((track) => ({
        ...track,
        createdAt: track.createdAt.toISOString(),
        updatedAt: track.updatedAt.toISOString(),
      })),
  };
}

async function ensureDefaultTracks(practiceId: string) {
  await Promise.all(
    DAILY_AUDIO_TRACKS.map((track) =>
      prisma.dailyAudioPracticeTrack.upsert({
        where: {
          practiceId_mode: {
            practiceId,
            mode: track.mode,
          },
        },
        create: {
          practiceId,
          mode: track.mode,
          title: track.title,
          sortOrder: track.sortOrder,
          status: 'draft',
        },
        update: {
          title: track.title,
          sortOrder: track.sortOrder,
        },
      })
    )
  );
}

async function getUserLanguagePreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredStudyLanguage: true,
      preferredNativeLanguage: true,
    },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return {
    targetLanguage: user.preferredStudyLanguage || 'ja',
    nativeLanguage: user.preferredNativeLanguage || 'en',
  };
}

router.post(
  '/',
  rateLimitStudyRoute({
    key: 'daily-audio-practice',
    max: 10,
    windowMs: 60 * 60 * 1000,
    onBackendError: 'fail-closed',
  }),
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) throw new AppError('Authentication required.', 401);

      const body = req.body as { timeZone?: unknown; targetDurationMinutes?: unknown };
      const practiceDate = getLocalPracticeDate(body.timeZone);
      const targetDurationMinutes = parseTargetDurationMinutes(body.targetDurationMinutes);
      const languagePreferences = await getUserLanguagePreferences(req.userId);

      const practice = await prisma.dailyAudioPractice.upsert({
        where: {
          userId_practiceDate: {
            userId: req.userId,
            practiceDate,
          },
        },
        create: {
          userId: req.userId,
          practiceDate,
          status: 'draft',
          targetDurationMinutes,
          targetLanguage: languagePreferences.targetLanguage,
          nativeLanguage: languagePreferences.nativeLanguage,
        },
        update: {
          targetDurationMinutes,
          targetLanguage: languagePreferences.targetLanguage,
          nativeLanguage: languagePreferences.nativeLanguage,
        },
      });
      await ensureDefaultTracks(practice.id);

      if (practice.status !== 'ready' && practice.status !== 'generating') {
        const started = await prisma.dailyAudioPractice.updateMany({
          where: {
            id: practice.id,
            status: {
              notIn: ['ready', 'generating'],
            },
          },
          data: { status: 'generating', errorMessage: null },
        });

        if (started.count > 0) {
          try {
            await enqueueDailyAudioPracticeJob(practice.id);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await prisma.dailyAudioPractice.update({
              where: { id: practice.id },
              data: { status: 'error', errorMessage: message },
            });
            throw error;
          }
        }
      }

      const fullPractice = await prisma.dailyAudioPractice.findUniqueOrThrow({
        where: { id: practice.id },
        include: { tracks: true },
      });
      res.status(202).json(serializePractice(fullPractice));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError('Authentication required.', 401);
    const practices = await prisma.dailyAudioPractice.findMany({
      where: { userId: req.userId },
      include: { tracks: true },
      orderBy: { practiceDate: 'desc' },
      take: 14,
    });
    res.json(practices.map(serializePractice));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError('Authentication required.', 401);
    const practice = await prisma.dailyAudioPractice.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { tracks: true },
    });
    if (!practice) throw new AppError('Daily Audio Practice not found.', 404);
    res.json(serializePractice(practice));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError('Authentication required.', 401);
    const practice = await prisma.dailyAudioPractice.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { tracks: true },
    });
    if (!practice) throw new AppError('Daily Audio Practice not found.', 404);

    let progress: number | null = null;
    if (practice.status === 'generating') {
      const job = await dailyAudioPracticeQueue.getJob(practice.id);
      progress =
        typeof job?.progress === 'number'
          ? job.progress
          : practice.tracks.filter((track) => track.status === 'ready').length * 30;
    }

    res.json({
      id: practice.id,
      status: practice.status,
      progress,
      tracks: practice.tracks.map((track) => ({
        id: track.id,
        mode: track.mode,
        status: track.status,
        audioUrl: track.audioUrl,
        approxDurationSeconds: track.approxDurationSeconds,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
