/* eslint-disable no-console */
/* eslint-disable import/no-named-as-default-member */
// Console logging is necessary for OAuth callback monitoring
// Using default imports for bcrypt and jwt per their official documentation
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import passport from '../config/passport.js';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { emailQueue } from '../jobs/emailQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { isAdminEmail } from '../middleware/roleAuth.js';
import { copySampleContentToUser } from '../services/sampleContent.js';
import { checkGenerationLimit, checkCooldown } from '../services/usageTracker.js';

const router = Router();

// Sign up
router.post('/signup', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { email, password, name, inviteCode } = req.body;

    console.log(`[SIGNUP] Request received: ${email}`);

    if (!email || !password || !name) {
      throw new AppError(i18next.t('server:auth.emailRequired'), 400);
    }

    if (!inviteCode) {
      throw new AppError(i18next.t('server:auth.inviteRequired'), 400);
    }

    // Validate invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
    });

    if (!invite) {
      throw new AppError(i18next.t('server:auth.inviteInvalid'), 400);
    }

    if (invite.usedBy) {
      throw new AppError(i18next.t('server:auth.inviteUsed'), 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Check if this is a retry (invite already used by this user)
      const usedInvite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });

      if (usedInvite?.usedBy === existingUser.id) {
        // Idempotent retry - recreate session and return success
        console.log(`[SIGNUP] Idempotent retry detected: ${email} (id: ${existingUser.id})`);

        const token = jwt.sign({ userId: existingUser.id }, process.env.JWT_SECRET!, {
          expiresIn: '7d',
        });

        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Queue verification email if not yet verified
        if (!existingUser.emailVerified) {
          await emailQueue.add(
            'send-verification',
            {
              type: 'verification',
              userId: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
              removeOnFail: { age: 7 * 24 * 60 * 60 },
            }
          );
          console.log(`[SIGNUP] Retry verification email queued: ${existingUser.email}`);
        }

        const duration = Date.now() - startTime;
        console.log(
          `[SIGNUP] Response sent (idempotent retry): ${existingUser.id} ${email} ${duration}ms`
        );

        return res.json({
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          displayName: existingUser.displayName,
          avatarColor: existingUser.avatarColor,
          role: existingUser.role,
          tier: existingUser.tier,
          preferredStudyLanguage: existingUser.preferredStudyLanguage,
          preferredNativeLanguage: existingUser.preferredNativeLanguage,
          pinyinDisplayMode: existingUser.pinyinDisplayMode,
          proficiencyLevel: existingUser.proficiencyLevel,
          onboardingCompleted: existingUser.onboardingCompleted,
          emailVerified: existingUser.emailVerified,
          emailVerifiedAt: existingUser.emailVerifiedAt,
          isTestUser: existingUser.isTestUser,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
        });
      }

      throw new AppError(i18next.t('server:auth.userExists'), 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user should be admin
    const role = isAdminEmail(email) ? 'admin' : 'user';

    console.log(`[SIGNUP] Starting transaction: ${email}`);

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
          tier: true,
          preferredStudyLanguage: true,
          preferredNativeLanguage: true,
          pinyinDisplayMode: true,
          proficiencyLevel: true,
          onboardingCompleted: true,
          emailVerified: true,
          emailVerifiedAt: true,
          isTestUser: true,
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

    console.log(`[SIGNUP] User created: ${user.id} ${email}`);

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

    // Queue verification email (non-blocking with retries)
    await emailQueue.add(
      'send-verification',
      {
        type: 'verification',
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[SIGNUP] Verification email queued: ${email}`);
    console.log(`[SIGNUP] Response sent: ${user.id} ${email} ${duration}ms`);

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
      throw new AppError(i18next.t('server:auth.invalidCredentials'), 401);
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new AppError(i18next.t('server:auth.invalidCredentials'), 401);
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
      tier: updatedUser.tier,
      preferredStudyLanguage: updatedUser.preferredStudyLanguage,
      preferredNativeLanguage: updatedUser.preferredNativeLanguage,
      pinyinDisplayMode: updatedUser.pinyinDisplayMode,
      proficiencyLevel: updatedUser.proficiencyLevel,
      onboardingCompleted: updatedUser.onboardingCompleted,
      emailVerified: updatedUser.emailVerified,
      emailVerifiedAt: updatedUser.emailVerifiedAt,
      isTestUser: updatedUser.isTestUser,
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
        tier: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        pinyinDisplayMode: true,
        proficiencyLevel: true,
        onboardingCompleted: true,
        seenSampleContentGuide: true,
        seenCustomContentGuide: true,
        emailVerified: true,
        emailVerifiedAt: true,
        isTestUser: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(i18next.t('server:auth.userNotFound'), 404);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.patch('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      displayName,
      avatarColor,
      avatarUrl,
      preferredStudyLanguage,
      preferredNativeLanguage,
      pinyinDisplayMode,
      proficiencyLevel,
      onboardingCompleted,
      seenSampleContentGuide,
      seenCustomContentGuide,
    } = req.body;

    // Validate avatarColor if provided
    const validColors = ['indigo', 'teal', 'purple', 'pink', 'emerald', 'amber', 'rose', 'cyan'];
    if (avatarColor && !validColors.includes(avatarColor)) {
      throw new AppError('Invalid avatar color', 400);
    }

    // Validate language codes if provided
    const validLanguages = ['ja', 'zh', 'es', 'fr', 'ar', 'en'];
    if (preferredStudyLanguage && !validLanguages.includes(preferredStudyLanguage)) {
      throw new AppError('Invalid study language', 400);
    }
    if (preferredNativeLanguage && !validLanguages.includes(preferredNativeLanguage)) {
      throw new AppError('Invalid native language', 400);
    }

    // Validate that study and native languages are different
    if (
      preferredStudyLanguage &&
      preferredNativeLanguage &&
      preferredStudyLanguage === preferredNativeLanguage
    ) {
      throw new AppError('Study language and native language must be different', 400);
    }

    // Validate pinyin display mode if provided
    const validPinyinModes = ['toneMarks', 'toneNumbers'];
    if (pinyinDisplayMode && !validPinyinModes.includes(pinyinDisplayMode)) {
      throw new AppError('Invalid pinyin display mode', 400);
    }

    // Validate proficiency level if provided
    const validProficiencyLevels = [
      'N5',
      'N4',
      'N3',
      'N2',
      'N1', // JLPT (Japanese)
      'HSK1',
      'HSK2',
      'HSK3',
      'HSK4',
      'HSK5',
      'HSK6', // HSK (Chinese)
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2', // CEFR (Spanish/European languages)
    ];
    if (proficiencyLevel && !validProficiencyLevels.includes(proficiencyLevel)) {
      throw new AppError('Invalid proficiency level', 400);
    }

    // Build update data object (only include provided fields)
    const updateData: Prisma.UserUpdateInput = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarColor !== undefined) updateData.avatarColor = avatarColor;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (preferredStudyLanguage !== undefined)
      updateData.preferredStudyLanguage = preferredStudyLanguage;
    if (preferredNativeLanguage !== undefined)
      updateData.preferredNativeLanguage = preferredNativeLanguage;
    if (pinyinDisplayMode !== undefined) updateData.pinyinDisplayMode = pinyinDisplayMode;
    if (proficiencyLevel !== undefined) updateData.proficiencyLevel = proficiencyLevel;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;
    if (seenSampleContentGuide !== undefined)
      updateData.seenSampleContentGuide = seenSampleContentGuide;
    if (seenCustomContentGuide !== undefined)
      updateData.seenCustomContentGuide = seenCustomContentGuide;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400);
    }

    const previousUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { onboardingCompleted: true },
    });

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
        tier: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        pinyinDisplayMode: true,
        proficiencyLevel: true,
        onboardingCompleted: true,
        seenSampleContentGuide: true,
        seenCustomContentGuide: true,
        emailVerified: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Copy sample content when user completes onboarding for the first time
    if (
      onboardingCompleted === true &&
      previousUser &&
      !previousUser.onboardingCompleted &&
      user.preferredStudyLanguage &&
      user.proficiencyLevel
    ) {
      try {
        await copySampleContentToUser(user.id, user.preferredStudyLanguage, user.proficiencyLevel);
        console.log(
          `[ONBOARDING] Sample content copied for user ${user.id} (${user.preferredStudyLanguage} ${user.proficiencyLevel})`
        );
      } catch (error) {
        console.error('[ONBOARDING] Failed to copy sample content:', error);
        // Don't fail the request if sample content copy fails
      }
    }

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
      throw new AppError(i18next.t('server:auth.passwordFieldsRequired'), 400);
    }

    if (newPassword.length < 8) {
      throw new AppError(i18next.t('server:auth.passwordTooShort'), 400);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      throw new AppError(i18next.t('server:auth.userNotFound'), 404);
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

    res.json({ message: i18next.t('server:auth.passwordChanged') });
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

    res.json({ message: i18next.t('server:auth.accountDeleted') });
  } catch (error) {
    next(error);
  }
});

// Get quota status for current user
router.get('/me/quota', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    // Admins get unlimited
    if (user?.role === 'admin') {
      return res.json({
        unlimited: true,
        quota: null,
        cooldown: { active: false, remainingSeconds: 0 },
      });
    }

    const status = await checkGenerationLimit(req.userId!, 'dialogue');
    const cooldown = await checkCooldown(req.userId!);

    res.json({
      unlimited: false,
      quota: status,
      cooldown,
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth - Initiate
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth - Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  async (req, res) => {
    try {
      // Passport attaches the user object with custom properties
      const user = req.user as { id: string; isExistingUser?: boolean } | undefined;

      if (!user) {
        return res.redirect(
          `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed`
        );
      }

      // If this is an existing user (not newly created via OAuth), skip invite code check
      // Existing users already have access to the system
      if (user.isExistingUser) {
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
          expiresIn: '7d',
        });

        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/app/library`);
      }

      // For new OAuth users, check if they have an invite code
      const inviteCode = await prisma.inviteCode.findFirst({
        where: { usedBy: user.id },
      });

      // If new user doesn't have an invite code, redirect to claim invite page
      if (!inviteCode) {
        // Create a temporary JWT for the claim invite flow
        const tempToken = jwt.sign(
          { userId: user.id, requiresInvite: true },
          process.env.JWT_SECRET!,
          { expiresIn: '15m' }
        );

        return res.redirect(
          `${process.env.CLIENT_URL || 'http://localhost:5173'}/claim-invite?token=${tempToken}`
        );
      }

      // New user has invite code, create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
        expiresIn: '7d',
      });

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to app
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/app/library`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
    }
  }
);

// Claim invite code (for OAuth users)
router.post('/claim-invite', async (req, res, next) => {
  try {
    const { inviteCode, token } = req.body;

    if (!inviteCode || !token) {
      throw new AppError('Invite code and token are required', 400);
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload & { userId: string };
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }

    if (!decoded.requiresInvite) {
      throw new AppError('Invalid token', 401);
    }

    // Validate invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
    });

    if (!invite) {
      throw new AppError('Invalid invite code', 400);
    }

    if (invite.usedBy) {
      throw new AppError('This invite code has already been used', 400);
    }

    // Mark invite code as used
    await prisma.inviteCode.update({
      where: { code: inviteCode },
      data: {
        usedBy: decoded.userId,
        usedAt: new Date(),
      },
    });

    // Create session token
    const sessionToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarColor: true,
        avatarUrl: true,
        role: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        pinyinDisplayMode: true,
        proficiencyLevel: true,
        onboardingCompleted: true,
        seenSampleContentGuide: true,
        seenCustomContentGuide: true,
        emailVerified: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
