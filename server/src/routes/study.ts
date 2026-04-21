import { Router } from 'express';
import multer, { memoryStorage } from 'multer';

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  createStudyCard,
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
const upload = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

router.use(requireAuth);

router.post('/imports', upload.single('file'), async (req: AuthRequest, res, next) => {
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
});

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

router.post('/session/start', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new Error('Authenticated user is required.');
    }
    const requestedLimit =
      typeof req.body?.limit === 'number' && Number.isFinite(req.body.limit) ? req.body.limit : 20;
    const session = await startStudySession(req.userId, Math.max(1, Math.min(200, requestedLimit)));
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post('/reviews', async (req: AuthRequest, res, next) => {
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
});

router.post('/reviews/undo', async (req: AuthRequest, res, next) => {
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
});

router.post('/cards', async (req: AuthRequest, res, next) => {
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
      cardType: cardType as 'recognition' | 'production' | 'cloze',
      prompt: prompt as Record<string, unknown>,
      answer: answer as Record<string, unknown>,
    });

    res.status(201).json(createdCard);
  } catch (error) {
    next(error);
  }
});

router.patch('/cards/:cardId', async (req: AuthRequest, res, next) => {
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
      prompt: prompt as Record<string, unknown>,
      answer: answer as Record<string, unknown>,
    });

    res.json(updatedCard);
  } catch (error) {
    next(error);
  }
});

router.post('/cards/:cardId/actions', async (req: AuthRequest, res, next) => {
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
});

router.post('/cards/:cardId/prepare-answer-audio', async (req: AuthRequest, res, next) => {
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

    const page =
      typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : undefined;
    const pageSize =
      typeof req.query.pageSize === 'string' ? Number.parseInt(req.query.pageSize, 10) : undefined;

    const result = await getStudyBrowserList({
      userId: req.userId,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      noteType: typeof req.query.noteType === 'string' ? req.query.noteType : undefined,
      cardType:
        typeof req.query.cardType === 'string'
          ? (req.query.cardType as 'recognition' | 'production' | 'cloze')
          : undefined,
      queueState:
        typeof req.query.queueState === 'string'
          ? (req.query.queueState as
              | 'new'
              | 'learning'
              | 'review'
              | 'relearning'
              | 'suspended'
              | 'buried')
          : undefined,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
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
