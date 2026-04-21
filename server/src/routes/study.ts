import type {
  StudyAnswerPayload,
  StudyCardType,
  StudyPromptPayload,
  StudyQueueState,
} from '@languageflow/shared/src/types.js';
import { Router } from 'express';
import multer, { memoryStorage } from 'multer';

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import {
  createStudyCard,
  getStudyCardOptions,
  exportStudyData,
  getStudyBrowserList,
  getStudyBrowserNoteDetail,
  getStudyHistory,
  getStudyImportJob,
  getStudyOverview,
  importJapaneseStudyColpkg,
  performStudyCardAction,
  prepareStudyCardAnswerAudio,
  recordStudyReview,
  startStudySession,
  undoStudyReview,
  updateStudyCard,
} from '../services/studyService.js';

const router = Router();
const STUDY_BROWSER_QUERY_MAX_LENGTH = 200;
const STUDY_BROWSER_PAGE_SIZE_MAX = 100;
const STUDY_CARD_TYPES = new Set<StudyCardType>(['recognition', 'production', 'cloze']);
const STUDY_QUEUE_STATES = new Set<StudyQueueState>([
  'new',
  'learning',
  'review',
  'relearning',
  'suspended',
  'buried',
]);
const STUDY_IMPORT_MIME_TYPES = new Set([
  '',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'multipart/x-zip',
]);
const upload = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const hasColpkgExtension = file.originalname.toLowerCase().endsWith('.colpkg');
    const hasAcceptedMimeType = STUDY_IMPORT_MIME_TYPES.has(file.mimetype ?? '');

    if (hasColpkgExtension && hasAcceptedMimeType) {
      cb(null, true);
      return;
    }

    cb(new AppError('Only .colpkg Anki collection backups are accepted.', 400));
  },
});

function parsePositiveIntegerQueryParam(name: string, value: unknown): number | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(`${name} must be a positive integer.`, 400);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(`${name} must be a positive integer.`, 400);
  }

  return parsed;
}

function parseBrowserQueryString(value: unknown): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError('q must be a string.', 400);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > STUDY_BROWSER_QUERY_MAX_LENGTH) {
    throw new AppError(
      `q must be ${String(STUDY_BROWSER_QUERY_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  return trimmed;
}

router.use(requireAuth);
router.use(requireFeatureFlag('flashcardsEnabled'));

router.post(
  '/imports',
  rateLimitStudyRoute({ key: 'import', max: 3, windowMs: 10 * 60 * 1000 }),
  upload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }
      if (!req.file) {
        res.status(400).json({ message: 'Please choose a .colpkg file to import.' });
        return;
      }

      const result = await importJapaneseStudyColpkg({
        userId: req.userId,
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/imports/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }
    const result = await getStudyImportJob(req.userId, req.params.id);
    if (!result) {
      res.status(404).json({ message: 'Study import not found.' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }
    const overview = await getStudyOverview(req.userId);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/session/start',
  rateLimitStudyRoute({ key: 'session-start', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }
      const requestedLimit =
        typeof req.body?.limit === 'number' && Number.isFinite(req.body.limit)
          ? req.body.limit
          : 20;
      const session = await startStudySession(
        req.userId,
        Math.max(1, Math.min(200, requestedLimit))
      );
      res.json(session);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reviews',
  rateLimitStudyRoute({ key: 'reviews', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      const { cardId, grade, durationMs } = req.body as {
        cardId?: unknown;
        grade?: unknown;
        durationMs?: unknown;
      };

      if (typeof cardId !== 'string' || !cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }
      if (!['again', 'hard', 'good', 'easy'].includes(String(grade))) {
        res.status(400).json({ message: 'grade must be again, hard, good, or easy.' });
        return;
      }

      const reviewResult = await recordStudyReview({
        userId: req.userId,
        cardId,
        grade: grade as 'again' | 'hard' | 'good' | 'easy',
        durationMs: typeof durationMs === 'number' ? durationMs : undefined,
      });

      res.json(reviewResult);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reviews/undo',
  rateLimitStudyRoute({ key: 'review-undo', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      const { reviewLogId } = req.body as {
        reviewLogId?: unknown;
      };

      if (typeof reviewLogId !== 'string' || !reviewLogId) {
        res.status(400).json({ message: 'reviewLogId is required.' });
        return;
      }

      const undoResult = await undoStudyReview({
        userId: req.userId,
        reviewLogId,
      });

      res.json(undoResult);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards',
  rateLimitStudyRoute({ key: 'card-create', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      const { cardType, prompt, answer } = req.body as {
        cardType?: unknown;
        prompt?: unknown;
        answer?: unknown;
      };

      if (!['recognition', 'production', 'cloze'].includes(String(cardType))) {
        res.status(400).json({ message: 'cardType must be recognition, production, or cloze.' });
        return;
      }

      if (
        typeof prompt !== 'object' ||
        prompt === null ||
        typeof answer !== 'object' ||
        answer === null
      ) {
        res.status(400).json({ message: 'prompt and answer payloads are required.' });
        return;
      }

      const createdCard = await createStudyCard({
        userId: req.userId,
        cardType: cardType as StudyCardType,
        prompt: prompt as StudyPromptPayload,
        answer: answer as StudyAnswerPayload,
      });

      res.status(201).json(createdCard);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/cards/:cardId',
  rateLimitStudyRoute({ key: 'card-update', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      const { prompt, answer } = req.body as {
        prompt?: unknown;
        answer?: unknown;
      };

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      if (
        typeof prompt !== 'object' ||
        prompt === null ||
        typeof answer !== 'object' ||
        answer === null
      ) {
        res.status(400).json({ message: 'prompt and answer payloads are required.' });
        return;
      }

      const updatedCard = await updateStudyCard({
        userId: req.userId,
        cardId: req.params.cardId,
        prompt: prompt as StudyPromptPayload,
        answer: answer as StudyAnswerPayload,
      });

      res.json(updatedCard);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards/:cardId/actions',
  rateLimitStudyRoute({ key: 'card-action', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      const { action, mode, dueAt } = req.body as {
        action?: unknown;
        mode?: unknown;
        dueAt?: unknown;
      };

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      if (!['suspend', 'unsuspend', 'forget', 'set_due'].includes(String(action))) {
        res.status(400).json({ message: 'action must be suspend, unsuspend, forget, or set_due.' });
        return;
      }

      if (action === 'set_due') {
        if (!['now', 'tomorrow', 'custom_date'].includes(String(mode))) {
          res
            .status(400)
            .json({ message: 'mode must be now, tomorrow, or custom_date for set_due.' });
          return;
        }

        if (
          mode === 'custom_date' &&
          (typeof dueAt !== 'string' || Number.isNaN(Date.parse(dueAt)))
        ) {
          res.status(400).json({ message: 'dueAt must be a valid ISO date for custom_date.' });
          return;
        }
      }

      const result = await performStudyCardAction({
        userId: req.userId,
        cardId: req.params.cardId,
        action: action as 'suspend' | 'unsuspend' | 'forget' | 'set_due',
        mode: mode as 'now' | 'tomorrow' | 'custom_date' | undefined,
        dueAt: typeof dueAt === 'string' ? dueAt : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards/:cardId/prepare-answer-audio',
  rateLimitStudyRoute({ key: 'prepare-answer-audio', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new Error('Authenticated user is required.');
      }

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      const card = await prepareStudyCardAnswerAudio(req.userId, req.params.cardId);
      res.json(card);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/cards/options', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }

    const parsedLimit =
      typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
    const limit =
      typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(100, parsedLimit))
        : 100;
    const result = await getStudyCardOptions(req.userId, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }
    const cardId = typeof req.query.cardId === 'string' ? req.query.cardId : undefined;
    const history = await getStudyHistory(req.userId, cardId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get('/browser', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }

    const q = parseBrowserQueryString(req.query.q);
    const page = parsePositiveIntegerQueryParam('page', req.query.page);
    const pageSize = parsePositiveIntegerQueryParam('pageSize', req.query.pageSize);
    if (typeof pageSize === 'number' && pageSize > STUDY_BROWSER_PAGE_SIZE_MAX) {
      throw new AppError(`pageSize must be ${String(STUDY_BROWSER_PAGE_SIZE_MAX)} or fewer.`, 400);
    }

    const cardType =
      typeof req.query.cardType === 'undefined' ? undefined : String(req.query.cardType);
    if (typeof cardType !== 'undefined' && !STUDY_CARD_TYPES.has(cardType as StudyCardType)) {
      throw new AppError('cardType must be recognition, production, or cloze.', 400);
    }

    const queueState =
      typeof req.query.queueState === 'undefined' ? undefined : String(req.query.queueState);
    if (
      typeof queueState !== 'undefined' &&
      !STUDY_QUEUE_STATES.has(queueState as StudyQueueState)
    ) {
      throw new AppError(
        'queueState must be new, learning, review, relearning, suspended, or buried.',
        400
      );
    }

    const result = await getStudyBrowserList({
      userId: req.userId,
      q,
      noteType: typeof req.query.noteType === 'string' ? req.query.noteType : undefined,
      cardType: cardType as StudyCardType | undefined,
      queueState: queueState as StudyQueueState | undefined,
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/browser/:noteId', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }

    const result = await getStudyBrowserNoteDetail(req.userId, req.params.noteId);
    if (!result) {
      res.status(404).json({ message: 'Study note not found.' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }
    const manifest = await exportStudyData(req.userId);
    res.json(manifest);
  } catch (error) {
    next(error);
  }
});

export default router;
