import { Router } from 'express';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import crypto from 'crypto';
import multer from 'multer';
import {
  uploadUserAvatar,
  uploadSpeakerAvatar,
  recropSpeakerAvatar,
  getSpeakerAvatarOriginalUrl,
  getAllSpeakerAvatars,
} from '../services/avatarService.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
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
    const [
      userCount,
      episodeCount,
      courseCount,
      narrowListeningCount,
      chunkPackCount,
      inviteCodeCount,
      usedInviteCodeCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.episode.count(),
      prisma.course.count(),
      prisma.narrowListeningPack.count(),
      prisma.chunkPack.count(),
      prisma.inviteCode.count(),
      prisma.inviteCode.count({ where: { usedBy: { not: null } } }),
    ]);

    res.json({
      users: userCount,
      episodes: episodeCount,
      courses: courseCount,
      narrowListeningPacks: narrowListeningCount,
      chunkPacks: chunkPackCount,
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
              narrowListeningPacks: true,
              chunkPacks: true,
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
    if (!/^(ja|zh)-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const originalUrl = await getSpeakerAvatarOriginalUrl(filename);
    res.json({ originalUrl });
  } catch (error) {
    next(error);
  }
});

// Upload new speaker avatar
router.post('/avatars/speaker/:filename/upload', upload.single('image'), async (req: AuthRequest, res, next) => {
  try {
    const { filename } = req.params;

    // Validate filename format
    if (!/^(ja|zh)-(male|female)-(casual|polite|formal)\.jpg$/i.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Parse crop area from request body
    const cropArea = JSON.parse(req.body.cropArea);
    if (!cropArea || typeof cropArea.x !== 'number' || typeof cropArea.y !== 'number' ||
        typeof cropArea.width !== 'number' || typeof cropArea.height !== 'number') {
      throw new AppError('Invalid crop area', 400);
    }

    const { croppedUrl, originalUrl } = await uploadSpeakerAvatar(filename, req.file.buffer, cropArea);

    res.json({
      message: 'Speaker avatar uploaded successfully',
      filename,
      croppedUrl,
      originalUrl,
    });
  } catch (error) {
    next(error);
  }
});

// Re-crop existing speaker avatar
router.post('/avatars/speaker/:filename/recrop', async (req: AuthRequest, res, next) => {
  try {
    const { filename } = req.params;

    // Validate filename format
    if (!/^(ja|zh)-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    // Parse crop area from request body
    const { cropArea } = req.body;
    if (!cropArea || typeof cropArea.x !== 'number' || typeof cropArea.y !== 'number' ||
        typeof cropArea.width !== 'number' || typeof cropArea.height !== 'number') {
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
    res.json(avatars);
  } catch (error) {
    next(error);
  }
});

// Upload user avatar
router.post('/avatars/user/:userId/upload', upload.single('image'), async (req: AuthRequest, res, next) => {
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
    if (!cropArea || typeof cropArea.x !== 'number' || typeof cropArea.y !== 'number' ||
        typeof cropArea.width !== 'number' || typeof cropArea.height !== 'number') {
      throw new AppError('Invalid crop area', 400);
    }

    const avatarUrl = await uploadUserAvatar(userId, req.file.buffer, cropArea);

    res.json({ message: 'User avatar uploaded successfully', avatarUrl });
  } catch (error) {
    next(error);
  }
});

export default router;
