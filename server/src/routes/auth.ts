import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarColor: true,
        createdAt: true,
        updatedAt: true,
      },
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

    // Create JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
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
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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
    const { displayName, avatarColor } = req.body;

    // Validate avatarColor if provided
    const validColors = ['indigo', 'teal', 'purple', 'pink', 'emerald', 'amber', 'rose', 'cyan'];
    if (avatarColor && !validColors.includes(avatarColor)) {
      throw new AppError('Invalid avatar color', 400);
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarColor !== undefined) updateData.avatarColor = avatarColor;

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
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
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
