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
} from '../services/avatarService.js';

import {
  createLearningOsAdminInviteCode,
  deleteLearningOsAdminInviteCode,
  deleteLearningOsAdminUser,
  listLearningOsAdminInviteCodes,
  listLearningOsAdminSpeakerAvatars,
  listLearningOsAdminUsers,
  showLearningOsAdminPronunciationDictionary,
  showLearningOsAdminSpeakerAvatarOriginal,
  showLearningOsAdminStats,
  showLearningOsAdminUser,
  updateLearningOsAdminPronunciationDictionary,
} from './learningOs/admin.js';

const router = Router();

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
router.get('/avatars/speaker/:filename/original', showLearningOsAdminSpeakerAvatarOriginal);

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
router.get('/avatars/speakers', listLearningOsAdminSpeakerAvatars);

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

router.get('/pronunciation-dictionaries', showLearningOsAdminPronunciationDictionary);
router.put('/pronunciation-dictionaries', updateLearningOsAdminPronunciationDictionary);

export default router;
