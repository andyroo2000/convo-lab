/**
 * Usage tracking service for rate limiting and quota management
 */

import { prisma } from '../db/client.js';
import { createRedisConnection } from '../config/redis.js';
import { getMonthStart, getNextMonthStart } from '../utils/dateUtils.js';

// Free tier: Lifetime limits per content type
const FREE_TIER_LIFETIME_LIMITS: Record<string, number> = {
  dialogue: 2, // 2 dialogues ever
  course: 1, // 1 audio course ever
  narrow_listening: 0, // Not available in free tier for MVP
};

// Paid tier: Monthly quota (all content types combined)
const PAID_TIER_MONTHLY_LIMIT = 30;

const COOLDOWN_SECONDS = 30;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
  unlimited?: boolean;
}

export type ContentType = 'dialogue' | 'course' | 'narrow_listening';

/**
 * Check if user can generate content (quota check only)
 *
 * Free tier: Lifetime limits per content type (2 dialogues, 1 course, others disabled)
 * Paid tier: 30 generations per month (all content types combined, resets 1st of month)
 * Admin: Unlimited
 *
 * @param userId - User ID to check
 * @param contentType - Type of content being generated
 * @returns QuotaStatus with allowed flag, usage counts, and reset date
 */
export async function checkGenerationLimit(
  userId: string,
  contentType: ContentType
): Promise<QuotaStatus> {
  // Get user tier and role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, role: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Admins have unlimited generations
  if (user.role === 'admin') {
    return {
      allowed: true,
      used: 0,
      limit: 0,
      remaining: 0,
      resetsAt: getNextMonthStart(),
      unlimited: true,
    };
  }

  // Free tier: Lifetime limits per content type
  if (user.tier === 'free') {
    const contentTypeLimit = FREE_TIER_LIFETIME_LIMITS[contentType] || 0;

    // Content type not available for free tier
    if (contentTypeLimit === 0) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
        resetsAt: new Date('9999-12-31'), // Never resets (upgrade required)
      };
    }

    // Count all-time generations for this content type
    const count = await prisma.generationLog.count({
      where: {
        userId,
        contentType,
      },
    });

    const remaining = contentTypeLimit - count;

    return {
      allowed: remaining > 0,
      used: count,
      limit: contentTypeLimit,
      remaining: Math.max(0, remaining),
      resetsAt: new Date('9999-12-31'), // Lifetime limit, never resets
    };
  }

  // Paid tier (pro): Monthly quota for all content types combined
  const monthStart = getMonthStart();

  // Count generations this month (all content types)
  const count = await prisma.generationLog.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
    },
  });

  const remaining = PAID_TIER_MONTHLY_LIMIT - count;
  const resetsAt = getNextMonthStart();

  return {
    allowed: remaining > 0,
    used: count,
    limit: PAID_TIER_MONTHLY_LIMIT,
    remaining: Math.max(0, remaining),
    resetsAt,
  };
}

/**
 * Log a generation event
 * This persists even if content is deleted to prevent quota gaming
 */
export async function logGeneration(
  userId: string,
  contentType: ContentType,
  contentId?: string
): Promise<void> {
  await prisma.generationLog.create({
    data: { userId, contentType, contentId },
  });
}

/**
 * Check cooldown (Redis)
 * Returns whether cooldown is active and remaining seconds
 */
export async function checkCooldown(userId: string): Promise<{
  active: boolean;
  remainingSeconds: number;
}> {
  const redis = createRedisConnection();

  try {
    const key = `cooldown:generation:${userId}`;
    const ttl = await redis.ttl(key);

    return {
      active: ttl > 0,
      remainingSeconds: Math.max(0, ttl),
    };
  } finally {
    redis.disconnect();
  }
}

/**
 * Set cooldown (Redis)
 * Prevents rapid-fire generation requests
 */
export async function setCooldown(userId: string): Promise<void> {
  const redis = createRedisConnection();

  try {
    const key = `cooldown:generation:${userId}`;
    await redis.setex(key, COOLDOWN_SECONDS, '1');
  } finally {
    redis.disconnect();
  }
}
