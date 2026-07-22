/* eslint-disable import/no-named-as-default-member */
import { Router } from 'express';
import multer from 'multer';

import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleAuth.js';

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
  recropLearningOsAdminSpeakerAvatar,
  uploadLearningOsAdminSpeakerAvatar,
  uploadLearningOsAdminUserAvatar,
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
  uploadLearningOsAdminSpeakerAvatar
);

// Re-crop existing speaker avatar
router.post('/avatars/speaker/:filename/recrop', recropLearningOsAdminSpeakerAvatar);

// Get all speaker avatars
router.get('/avatars/speakers', listLearningOsAdminSpeakerAvatars);

// Upload user avatar
router.post(
  '/avatars/user/:userId/upload',
  upload.single('image'),
  uploadLearningOsAdminUserAvatar
);

// ============================================
// Pronunciation Dictionary Routes
// ============================================

router.get('/pronunciation-dictionaries', showLearningOsAdminPronunciationDictionary);
router.put('/pronunciation-dictionaries', updateLearningOsAdminPronunciationDictionary);

export default router;
