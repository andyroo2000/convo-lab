/**
 * Usage tracking service for rate limiting and quota management
 */

import { prisma } from '../db/client.js';
import { createRedisConnection } from '../config/redis.js';
import { getWeekStart, getNextWeekStart } from '../utils/dateUtils.js';

const TIER_LIMITS: Record<string, number> = {
  free: 5,
  pro: 30,
};

const COOLDOWN_SECONDS = 30;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
  unlimited?: boolean;
}

export type ContentType = 'dialogue' | 'course' | 'narrow_listening' | 'chunk_pack' | 'pi_session';

/**
 * Check if user can generate content (quota check only)
 * Counts all generation logs for the current week (Monday-Sunday UTC)
 * Uses tier-based limits: free (5/week), pro (30/week), admin (unlimited)
 */
export async function checkGenerationLimit(userId: string): Promise<QuotaStatus> {
  const weekStart = getWeekStart();

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
      resetsAt: getNextWeekStart(),
      unlimited: true,
    };
  }

  // Get tier limit (default to free tier)
  const limit = TIER_LIMITS[user.tier] || TIER_LIMITS.free;

  // Count generations this week
  const count = await prisma.generationLog.count({
    where: {
      userId,
      createdAt: { gte: weekStart },
    },
  });

  const remaining = limit - count;
  const resetsAt = getNextWeekStart();

  return {
    allowed: remaining > 0,
    used: count,
    limit,
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
