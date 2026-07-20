/**
 * Usage tracking service for rate limiting and quota management
 */

import { createRedisConnection } from '../config/redis.js';
import { prisma } from '../db/client.js';
import { getMonthStart, getNextMonthStart } from '../utils/dateUtils.js';

const DEFAULT_MONTHLY_GENERATION_LIMIT = 30;
const COOLDOWN_SECONDS = 30;

function getMonthlyGenerationLimit(): number {
  const configuredLimit = Number.parseInt(process.env.MONTHLY_GENERATION_LIMIT ?? '', 10);
  return Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MONTHLY_GENERATION_LIMIT;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
  unlimited?: boolean;
}

export type ContentType = 'dialogue' | 'script' | 'course';

/**
 * Check if user can generate content (quota check only)
 *
 * All non-admin users share one monthly limit across content types.
 * Admins are unlimited.
 *
 * @param userId - User ID to check
 * @param contentType - Type of content being generated
 * @returns QuotaStatus with allowed flag, usage counts, and reset date
 */
export async function checkGenerationLimit(
  userId: string,
  _contentType: ContentType
): Promise<QuotaStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
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

  const monthStart = getMonthStart();
  const monthlyLimit = getMonthlyGenerationLimit();

  const count = await prisma.generationLog.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
    },
  });

  const remaining = monthlyLimit - count;
  const resetsAt = getNextMonthStart();

  return {
    allowed: remaining > 0,
    used: count,
    limit: monthlyLimit,
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
