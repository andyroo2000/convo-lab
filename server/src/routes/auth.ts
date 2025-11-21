import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { isAdminEmail } from '../middleware/roleAuth.js';

const router = Router();

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, inviteCode } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    if (!inviteCode) {
      throw new AppError('Invite code required. ConvoLab is currently invite-only.', 400);
    }

    // Validate invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
    });

    if (!invite) {
      throw new AppError('Invalid invite code.', 400);
    }

    if (invite.usedBy) {
      throw new AppError('This invite code has already been used.', 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user should be admin
    const role = isAdminEmail(email) ? 'admin' : 'user';

    // Create user and mark invite code as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarColor: true,
          role: true,
          preferredStudyLanguage: true,
          preferredNativeLanguage: true,
          pinyinDisplayMode: true,
          proficiencyLevel: true,
          onboardingCompleted: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Mark invite code as used
      await tx.inviteCode.update({
        where: { code: inviteCode },
        data: {
          usedBy: newUser.id,
          usedAt: new Date(),
        },
      });

      return newUser;
    });

    // Create JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user should be promoted to admin
    let updatedUser = user;
    if (isAdminEmail(email) && user.role !== 'admin') {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
      });
    }

    // Create JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      avatarColor: updatedUser.avatarColor,
      role: updatedUser.role,
      preferredStudyLanguage: updatedUser.preferredStudyLanguage,
      preferredNativeLanguage: updatedUser.preferredNativeLanguage,
      pinyinDisplayMode: updatedUser.pinyinDisplayMode,
      proficiencyLevel: updatedUser.proficiencyLevel,
      onboardingCompleted: updatedUser.onboardingCompleted,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarColor: true,
        role: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        pinyinDisplayMode: true,
        proficiencyLevel: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
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

// Update user profile
router.patch('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { displayName, avatarColor, avatarUrl, preferredStudyLanguage, preferredNativeLanguage, pinyinDisplayMode, proficiencyLevel, onboardingCompleted } = req.body;

    // Validate avatarColor if provided
    const validColors = ['indigo', 'teal', 'purple', 'pink', 'emerald', 'amber', 'rose', 'cyan'];
    if (avatarColor && !validColors.includes(avatarColor)) {
      throw new AppError('Invalid avatar color', 400);
    }

    // Validate language codes if provided
    const validLanguages = ['ja', 'zh', 'es', 'fr', 'ar', 'he', 'en'];
    if (preferredStudyLanguage && !validLanguages.includes(preferredStudyLanguage)) {
      throw new AppError('Invalid study language', 400);
    }
    if (preferredNativeLanguage && !validLanguages.includes(preferredNativeLanguage)) {
      throw new AppError('Invalid native language', 400);
    }

    // Validate pinyin display mode if provided
    const validPinyinModes = ['toneMarks', 'toneNumbers'];
    if (pinyinDisplayMode && !validPinyinModes.includes(pinyinDisplayMode)) {
      throw new AppError('Invalid pinyin display mode', 400);
    }

    // Validate proficiency level if provided
    const validProficiencyLevels = ['N5', 'N4', 'N3', 'N2', 'N1', 'HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
    if (proficiencyLevel && !validProficiencyLevels.includes(proficiencyLevel)) {
      throw new AppError('Invalid proficiency level', 400);
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarColor !== undefined) updateData.avatarColor = avatarColor;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (preferredStudyLanguage !== undefined) updateData.preferredStudyLanguage = preferredStudyLanguage;
    if (preferredNativeLanguage !== undefined) updateData.preferredNativeLanguage = preferredNativeLanguage;
    if (pinyinDisplayMode !== undefined) updateData.pinyinDisplayMode = pinyinDisplayMode;
    if (proficiencyLevel !== undefined) updateData.proficiencyLevel = proficiencyLevel;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarColor: true,
        role: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        pinyinDisplayMode: true,
        proficiencyLevel: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Change password
router.patch('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete user account
router.delete('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id: req.userId },
    });

    // Clear auth cookie
    res.clearCookie('token');

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
