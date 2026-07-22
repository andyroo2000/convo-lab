/* eslint-disable import/no-named-as-default-member */
import { Router } from 'express';
import multer from 'multer';

import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import {
  uploadUserAvatar,
  uploadSpeakerAvatar,
  recropSpeakerAvatar,
  getSpeakerAvatarOriginalUrl,
  getAllSpeakerAvatars,
} from '../services/avatarService.js';
import {
  getJapanesePronunciationDictionary,
  updateJapanesePronunciationDictionary,
} from '../services/japanesePronunciationOverrides.js';

import {
  createLearningOsAdminInviteCode,
  deleteLearningOsAdminInviteCode,
  deleteLearningOsAdminUser,
  listLearningOsAdminInviteCodes,
  listLearningOsAdminUsers,
  showLearningOsAdminStats,
  showLearningOsAdminUser,
} from './learningOs/admin.js';

const router = Router();
const MAX_KEEP_KANJI_ENTRIES = 500;
const MAX_FORCE_KANA_ENTRIES = 500;
const MAX_PRONUNCIATION_ENTRY_LENGTH = 64;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin);

// Get analytics stats
router.get('/stats', showLearningOsAdminStats);

// Get all users with pagination
router.get('/users', listLearningOsAdminUsers);

// Delete user
router.delete('/users/:id', deleteLearningOsAdminUser);

// Get user info for impersonation
router.get('/users/:id/info', showLearningOsAdminUser);

// Get all invite codes
router.get('/invite-codes', listLearningOsAdminInviteCodes);

// Create new invite code
router.post('/invite-codes', createLearningOsAdminInviteCode);

// Delete invite code
router.delete('/invite-codes/:id', deleteLearningOsAdminInviteCode);

// ============================================
// Avatar Management Routes
// ============================================

// Get original speaker avatar URL for re-cropping
router.get('/avatars/speaker/:filename/original', async (req: AuthRequest, res, next) => {
  try {
    const { filename } = req.params;

    // Validate filename format (language-gender-tone.jpg)
    if (!/^ja-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const originalUrl = await getSpeakerAvatarOriginalUrl(filename);
    res.json({ originalUrl });
  } catch (error) {
    next(error);
  }
});

// Upload new speaker avatar
router.post(
  '/avatars/speaker/:filename/upload',
  upload.single('image'),
  async (req: AuthRequest, res, next) => {
    try {
      const { filename } = req.params;

      // Validate filename format
      if (!/^ja-(male|female)-(casual|polite|formal)\.jpg$/i.test(filename)) {
        throw new AppError('Invalid avatar filename format', 400);
      }

      if (!req.file) {
        throw new AppError('No image file provided', 400);
      }

      // Parse crop area from request body
      const cropArea = JSON.parse(req.body.cropArea);
      if (
        !cropArea ||
        typeof cropArea.x !== 'number' ||
        typeof cropArea.y !== 'number' ||
        typeof cropArea.width !== 'number' ||
        typeof cropArea.height !== 'number'
      ) {
        throw new AppError('Invalid crop area', 400);
      }

      const { croppedUrl, originalUrl } = await uploadSpeakerAvatar(
        filename,
        req.file.buffer,
        cropArea
      );

      res.json({
        message: 'Speaker avatar uploaded successfully',
        filename,
        croppedUrl,
        originalUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Re-crop existing speaker avatar
router.post('/avatars/speaker/:filename/recrop', async (req: AuthRequest, res, next) => {
  try {
    const { filename } = req.params;

    // Validate filename format
    if (!/^ja-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    // Parse crop area from request body
    const { cropArea } = req.body;
    if (
      !cropArea ||
      typeof cropArea.x !== 'number' ||
      typeof cropArea.y !== 'number' ||
      typeof cropArea.width !== 'number' ||
      typeof cropArea.height !== 'number'
    ) {
      throw new AppError('Invalid crop area', 400);
    }

    const { croppedUrl, originalUrl } = await recropSpeakerAvatar(filename, cropArea);

    res.json({
      message: 'Speaker avatar re-cropped successfully',
      filename,
      croppedUrl,
      originalUrl,
    });
  } catch (error) {
    next(error);
  }
});

// Get all speaker avatars
router.get('/avatars/speakers', async (_req: AuthRequest, res, next) => {
  try {
    const avatars = await getAllSpeakerAvatars();
    // Avatars rarely change, cache for 1 hour on browser, 1 day on CDN
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.json(avatars);
  } catch (error) {
    next(error);
  }
});

// Upload user avatar
router.post(
  '/avatars/user/:userId/upload',
  upload.single('image'),
  async (req: AuthRequest, res, next) => {
    try {
      const { userId } = req.params;

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!req.file) {
        throw new AppError('No image file provided', 400);
      }

      // Parse crop area from request body
      const cropArea = JSON.parse(req.body.cropArea);
      if (
        !cropArea ||
        typeof cropArea.x !== 'number' ||
        typeof cropArea.y !== 'number' ||
        typeof cropArea.width !== 'number' ||
        typeof cropArea.height !== 'number'
      ) {
        throw new AppError('Invalid crop area', 400);
      }

      const avatarUrl = await uploadUserAvatar(userId, req.file.buffer, cropArea);

      res.json({ message: 'User avatar uploaded successfully', avatarUrl });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Pronunciation Dictionary Routes
// ============================================

router.get('/pronunciation-dictionaries', requireAdmin, async (_req: AuthRequest, res, next) => {
  try {
    res.json(getJapanesePronunciationDictionary());
  } catch (error) {
    next(error);
  }
});

router.put('/pronunciation-dictionaries', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const payload = req.body as {
      keepKanji?: unknown;
      forceKana?: unknown;
      verbKana?: unknown;
    };

    if (!Array.isArray(payload.keepKanji)) {
      throw new AppError('keepKanji must be an array of strings', 400);
    }
    if (
      !payload.forceKana ||
      typeof payload.forceKana !== 'object' ||
      Array.isArray(payload.forceKana)
    ) {
      throw new AppError('forceKana must be an object of word-to-kana mappings', 400);
    }

    if (payload.keepKanji.length > MAX_KEEP_KANJI_ENTRIES) {
      throw new AppError(
        `keepKanji must contain no more than ${MAX_KEEP_KANJI_ENTRIES} entries`,
        400
      );
    }

    const keepKanji = payload.keepKanji.map((entry) => {
      if (typeof entry !== 'string') {
        throw new AppError('keepKanji entries must be strings', 400);
      }
      const trimmed = entry.trim();
      if (!trimmed) {
        throw new AppError('keepKanji entries must be non-empty strings', 400);
      }
      if (trimmed.length > MAX_PRONUNCIATION_ENTRY_LENGTH) {
        throw new AppError(
          `keepKanji entries must be <= ${MAX_PRONUNCIATION_ENTRY_LENGTH} characters`,
          400
        );
      }
      return trimmed;
    });

    const parseKanaMap = (
      value: unknown,
      fieldName: 'forceKana' | 'verbKana'
    ): Record<string, string> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new AppError(`${fieldName} must be an object of word-to-kana mappings`, 400);
      }

      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > MAX_FORCE_KANA_ENTRIES) {
        throw new AppError(
          `${fieldName} must contain no more than ${MAX_FORCE_KANA_ENTRIES} entries`,
          400
        );
      }

      const parsed: Record<string, string> = {};
      for (const [word, kana] of entries) {
        if (typeof word !== 'string' || typeof kana !== 'string') {
          throw new AppError(`${fieldName} values must be strings`, 400);
        }
        const trimmedWord = word.trim();
        const trimmedKana = kana.trim();
        if (!trimmedWord || !trimmedKana) {
          throw new AppError(`${fieldName} entries must be non-empty strings`, 400);
        }
        if (
          trimmedWord.length > MAX_PRONUNCIATION_ENTRY_LENGTH ||
          trimmedKana.length > MAX_PRONUNCIATION_ENTRY_LENGTH
        ) {
          throw new AppError(
            `${fieldName} entries must be <= ${MAX_PRONUNCIATION_ENTRY_LENGTH} characters`,
            400
          );
        }
        parsed[trimmedWord] = trimmedKana;
      }

      return parsed;
    };

    const forceKana = parseKanaMap(payload.forceKana, 'forceKana');
    const verbKana =
      payload.verbKana === undefined ? undefined : parseKanaMap(payload.verbKana, 'verbKana');

    const updated = await updateJapanesePronunciationDictionary({ keepKanji, forceKana, verbKana });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
