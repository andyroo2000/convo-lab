import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  verifyEmailToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed
} from '../services/emailService.js';

const router = Router();

// Resend verification email
router.post('/verification/send', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.emailVerified) {
      throw new AppError('Email already verified', 400);
    }

    // Send verification email
    await sendVerificationEmail(user.id, user.email, user.name);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
});

// Verify email with token
router.get('/verification/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await verifyEmailToken(token);

    if (!result) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { name: true, email: true }
    });

    if (user) {
      // Send welcome email
      await sendWelcomeEmail(user.email, user.name);
    }

    res.json({
      message: 'Email verified successfully',
      email: result.email
    });
  } catch (error) {
    next(error);
  }
});

// Request password reset
router.post('/password-reset/request', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account exists with that email, a password reset link has been sent' });
      return;
    }

    // Send password reset email
    await sendPasswordResetEmail(user.id, user.email, user.name);

    res.json({ message: 'If an account exists with that email, a password reset link has been sent' });
  } catch (error) {
    next(error);
  }
});

// Verify password reset token (without resetting password yet)
router.get('/password-reset/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await verifyPasswordResetToken(token);

    if (!result) {
      throw new AppError('Invalid or expired password reset token', 400);
    }

    res.json({
      valid: true,
      email: result.email
    });
  } catch (error) {
    next(error);
  }
});

// Reset password with token
router.post('/password-reset/verify', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new AppError('Token and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Verify token
    const result = await verifyPasswordResetToken(token);

    if (!result) {
      throw new AppError('Invalid or expired password reset token', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: result.userId },
        data: { password: hashedPassword }
      });

      // Mark token as used
      await markPasswordResetTokenUsed(token);
    });

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { name: true, email: true }
    });

    if (user) {
      // Send confirmation email
      await sendPasswordChangedEmail(user.email, user.name);
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
