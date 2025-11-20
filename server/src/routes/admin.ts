import { Router } from 'express';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';
import crypto from 'crypto';

const router = Router();

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

export default router;
