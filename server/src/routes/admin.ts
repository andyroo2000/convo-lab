/* eslint-disable import/no-named-as-default-member */
import crypto from 'crypto';

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
  CLIENT_FEATURE_FLAG_SELECT,
  DEFAULT_CLIENT_FEATURE_FLAGS,
} from '../services/featureFlags.js';
import {
  getJapanesePronunciationDictionary,
  updateJapanesePronunciationDictionary,
} from '../services/japanesePronunciationOverrides.js';

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
router.get('/stats', async (_req: AuthRequest, res, next) => {
  try {
    const [userCount, episodeCount, courseCount, inviteCodeCount, usedInviteCodeCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.episode.count(),
        prisma.course.count(),
        prisma.inviteCode.count(),
        prisma.inviteCode.count({ where: { usedBy: { not: null } } }),
      ]);

    res.json({
      users: userCount,
      episodes: episodeCount,
      courses: courseCount,
      inviteCodes: {
        total: inviteCodeCount,
        used: usedInviteCodeCount,
        available: inviteCodeCount - usedInviteCodeCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all users with pagination
router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarColor: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              episodes: true,
              courses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.userId) {
      throw new AppError('Cannot delete your own account', 400);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      throw new AppError('Cannot delete admin users', 403);
    }

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get user info for impersonation
router.get('/users/:id/info', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        avatarColor: true,
        avatarUrl: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Get all invite codes
router.get('/invite-codes', async (_req: AuthRequest, res, next) => {
  try {
    const inviteCodes = await prisma.inviteCode.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(inviteCodes);
  } catch (error) {
    next(error);
  }
});

// Create new invite code
router.post('/invite-codes', async (req: AuthRequest, res, next) => {
  try {
    const { customCode } = req.body;

    let code: string;
    if (customCode) {
      // Validate custom code format (alphanumeric, 6-20 chars)
      if (!/^[A-Za-z0-9]{6,20}$/.test(customCode)) {
        throw new AppError('Custom code must be 6-20 alphanumeric characters', 400);
      }
      code = customCode;
    } else {
      // Generate random 8-character code
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    // Check if code already exists
    const existing = await prisma.inviteCode.findUnique({
      where: { code },
    });

    if (existing) {
      throw new AppError('This code already exists', 400);
    }

    const inviteCode = await prisma.inviteCode.create({
      data: { code },
    });

    res.json(inviteCode);
  } catch (error) {
    next(error);
  }
});

// Delete invite code
router.delete('/invite-codes/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if invite code exists
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { id },
    });

    if (!inviteCode) {
      throw new AppError('Invite code not found', 404);
    }

    // Prevent deleting used invite codes
    if (inviteCode.usedBy) {
      throw new AppError('Cannot delete used invite codes', 400);
    }

    await prisma.inviteCode.delete({
      where: { id },
    });

    res.json({ message: 'Invite code deleted successfully' });
  } catch (error) {
    next(error);
  }
});

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
// Feature Flag Routes
// ============================================

// Get feature flags
router.get('/feature-flags', async (_req: AuthRequest, res, next) => {
  try {
    // Feature flags is a singleton - get the first (and only) row
    let flags = await prisma.featureFlag.findFirst({
      select: CLIENT_FEATURE_FLAG_SELECT,
    });

    // If no flags exist, create default (all enabled)
    if (!flags) {
      flags = await prisma.featureFlag.create({
        data: DEFAULT_CLIENT_FEATURE_FLAGS,
        select: CLIENT_FEATURE_FLAG_SELECT,
      });
    }

    res.json(flags);
  } catch (error) {
    next(error);
  }
});

// Update feature flags
router.patch('/feature-flags', async (req: AuthRequest, res, next) => {
  try {
    const payload = req.body as {
      dialoguesEnabled?: unknown;
      scriptsEnabled?: unknown;
      audioCourseEnabled?: unknown;
      flashcardsEnabled?: unknown;
    };
    const { dialoguesEnabled, scriptsEnabled, audioCourseEnabled, flashcardsEnabled } = payload;

    // Validate boolean values
    const validateBoolean = (val: unknown, name: string) => {
      if (val !== undefined && typeof val !== 'boolean') {
        throw new AppError(`${name} must be a boolean`, 400);
      }
    };

    validateBoolean(dialoguesEnabled, 'dialoguesEnabled');
    validateBoolean(scriptsEnabled, 'scriptsEnabled');
    validateBoolean(audioCourseEnabled, 'audioCourseEnabled');
    validateBoolean(flashcardsEnabled, 'flashcardsEnabled');

    const dialoguesEnabledValue =
      typeof dialoguesEnabled === 'boolean' ? dialoguesEnabled : undefined;
    const scriptsEnabledValue = typeof scriptsEnabled === 'boolean' ? scriptsEnabled : undefined;
    const audioCourseEnabledValue =
      typeof audioCourseEnabled === 'boolean' ? audioCourseEnabled : undefined;
    const flashcardsEnabledValue =
      typeof flashcardsEnabled === 'boolean' ? flashcardsEnabled : undefined;

    // Get or create feature flags
    let flags = await prisma.featureFlag.findFirst({
      select: CLIENT_FEATURE_FLAG_SELECT,
    });

    if (!flags) {
      // Create with provided values (defaults to true for any undefined)
      flags = await prisma.featureFlag.create({
        data: {
          dialoguesEnabled: dialoguesEnabledValue ?? true,
          scriptsEnabled: scriptsEnabledValue ?? true,
          audioCourseEnabled: audioCourseEnabledValue ?? true,
          flashcardsEnabled: flashcardsEnabledValue ?? true,
        },
        select: CLIENT_FEATURE_FLAG_SELECT,
      });
    } else {
      // Update existing flags
      flags = await prisma.featureFlag.update({
        where: { id: flags.id },
        data: {
          ...(dialoguesEnabledValue !== undefined && { dialoguesEnabled: dialoguesEnabledValue }),
          ...(scriptsEnabledValue !== undefined && { scriptsEnabled: scriptsEnabledValue }),
          ...(audioCourseEnabledValue !== undefined && {
            audioCourseEnabled: audioCourseEnabledValue,
          }),
          ...(flashcardsEnabledValue !== undefined && {
            flashcardsEnabled: flashcardsEnabledValue,
          }),
        },
        select: CLIENT_FEATURE_FLAG_SELECT,
      });
    }

    res.json(flags);
  } catch (error) {
    next(error);
  }
});

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
