/* eslint-disable import/no-named-as-default-member */
import crypto from 'crypto';

import { Router } from 'express';
import multer from 'multer';
import type Stripe from 'stripe';

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

const router = Router();
const STRIPE_API_VERSION = '2024-12-18.acacia' as Stripe.LatestApiVersion;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
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
router.get('/stats', async (req: AuthRequest, res, next) => {
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
          tier: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeSubscriptionStatus: true,
          stripePriceId: true,
          subscriptionStartedAt: true,
          subscriptionExpiresAt: true,
          subscriptionCanceledAt: true,
          isTestUser: true,
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

// Get detailed subscription info for a user
router.get('/users/:id/subscription', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true,
        subscriptionStartedAt: true,
        subscriptionExpiresAt: true,
        subscriptionCanceledAt: true,
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

// Admin override: Manually set user tier (bypass Stripe)
router.post('/users/:id/tier', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { tier, reason } = req.body;

    // Validate tier
    if (!['free', 'pro'].includes(tier)) {
      throw new AppError('Invalid tier. Must be "free" or "pro"', 400);
    }

    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, tier: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Update user tier
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { tier },
    });

    // Log the admin action
    await prisma.subscriptionEvent.create({
      data: {
        userId: id,
        eventType: 'admin_override',
        fromTier: user.tier,
        toTier: tier,
        stripeEventId: `admin:${req.userId}:${reason || 'manual override'}`,
      },
    });

    res.json({
      message: `User tier updated from ${user.tier} to ${tier}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        tier: updatedUser.tier,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Toggle test user status
router.post('/users/:id/test-user', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { isTestUser } = req.body;

    // Validate input
    if (typeof isTestUser !== 'boolean') {
      throw new AppError('isTestUser must be a boolean', 400);
    }

    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isTestUser: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Update isTestUser flag
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isTestUser },
      select: { id: true, email: true, isTestUser: true },
    });

    res.json({
      message: `User test status updated to ${isTestUser}`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// Admin cancel subscription
router.post('/users/:id/subscription/cancel', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        tier: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.stripeSubscriptionId) {
      throw new AppError('User has no active subscription', 400);
    }

    // Import Stripe service for subscription cancellation
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
      apiVersion: STRIPE_API_VERSION,
    });

    // Cancel the subscription in Stripe
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);

    // Update user in database (webhook will handle full update)
    await prisma.user.update({
      where: { id },
      data: {
        tier: 'free',
        stripeSubscriptionStatus: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        subscriptionCanceledAt: new Date(),
      },
    });

    // Log the admin action
    await prisma.subscriptionEvent.create({
      data: {
        userId: id,
        eventType: 'admin_canceled',
        fromTier: user.tier,
        toTier: 'free',
        stripeEventId: `admin:${req.userId}:${reason || 'admin cancellation'}`,
      },
    });

    res.json({
      message: 'Subscription canceled successfully',
      user: {
        id: user.id,
        email: user.email,
        tier: 'free',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all invite codes
router.get('/invite-codes', async (req: AuthRequest, res, next) => {
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
router.get('/avatars/speakers', async (req: AuthRequest, res, next) => {
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
router.get('/feature-flags', async (req: AuthRequest, res, next) => {
  try {
    // Feature flags is a singleton - get the first (and only) row
    let flags = await prisma.featureFlag.findFirst();

    // If no flags exist, create default (all enabled)
    if (!flags) {
      flags = await prisma.featureFlag.create({
        data: {
          dialoguesEnabled: true,
          audioCourseEnabled: true,
        },
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
      audioCourseEnabled?: unknown;
    };
    const { dialoguesEnabled, audioCourseEnabled } = payload;

    // Validate boolean values
    const validateBoolean = (val: unknown, name: string) => {
      if (val !== undefined && typeof val !== 'boolean') {
        throw new AppError(`${name} must be a boolean`, 400);
      }
    };

    validateBoolean(dialoguesEnabled, 'dialoguesEnabled');
    validateBoolean(audioCourseEnabled, 'audioCourseEnabled');

    const dialoguesEnabledValue =
      typeof dialoguesEnabled === 'boolean' ? dialoguesEnabled : undefined;
    const audioCourseEnabledValue =
      typeof audioCourseEnabled === 'boolean' ? audioCourseEnabled : undefined;

    // Get or create feature flags
    let flags = await prisma.featureFlag.findFirst();

    if (!flags) {
      // Create with provided values (defaults to true for any undefined)
      flags = await prisma.featureFlag.create({
        data: {
          dialoguesEnabled: dialoguesEnabledValue ?? true,
          audioCourseEnabled: audioCourseEnabledValue ?? true,
        },
      });
    } else {
      // Update existing flags
      flags = await prisma.featureFlag.update({
        where: { id: flags.id },
        data: {
          ...(dialoguesEnabledValue !== undefined && { dialoguesEnabled: dialoguesEnabledValue }),
          ...(audioCourseEnabledValue !== undefined && {
            audioCourseEnabled: audioCourseEnabledValue,
          }),
        },
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

router.get('/pronunciation-dictionaries', async (_req: AuthRequest, res, next) => {
  try {
    res.json(getJapanesePronunciationDictionary());
  } catch (error) {
    next(error);
  }
});

router.put('/pronunciation-dictionaries', async (req: AuthRequest, res, next) => {
  try {
    const payload = req.body as {
      keepKanji?: unknown;
      forceKana?: unknown;
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

    const keepKanji = payload.keepKanji.map((entry) => {
      if (typeof entry !== 'string') {
        throw new AppError('keepKanji entries must be strings', 400);
      }
      return entry;
    });

    const forceKanaEntries = Object.entries(payload.forceKana as Record<string, unknown>);
    const forceKana: Record<string, string> = {};
    for (const [word, kana] of forceKanaEntries) {
      if (typeof word !== 'string' || typeof kana !== 'string') {
        throw new AppError('forceKana values must be strings', 400);
      }
      forceKana[word] = kana;
    }

    const updated = await updateJapanesePronunciationDictionary({ keepKanji, forceKana });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
