/**
 * Usage tracking service for rate limiting and quota management
 */

import { prisma } from '../db/client.js';
import { createRedisConnection } from '../config/redis.js';
import { getWeekStart, getNextWeekStart } from '../utils/dateUtils.js';

const WEEKLY_LIMIT = 20;
const COOLDOWN_SECONDS = 30;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date;
}

export type ContentType = 'dialogue' | 'course' | 'narrow_listening' | 'chunk_pack' | 'pi_session';

/**
 * Check if user can generate content (quota check only)
 * Counts all generation logs for the current week (Monday-Sunday UTC)
 */
export async function checkGenerationLimit(userId: string): Promise<QuotaStatus> {
  const weekStart = getWeekStart();

  // Count generations this week
  const count = await prisma.generationLog.count({
    where: {
      userId,
      createdAt: { gte: weekStart }
    }
  });

  const remaining = WEEKLY_LIMIT - count;
  const resetsAt = getNextWeekStart();

  return {
    allowed: remaining > 0,
    used: count,
    limit: WEEKLY_LIMIT,
    remaining: Math.max(0, remaining),
    resetsAt
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
    data: { userId, contentType, contentId }
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
      remainingSeconds: Math.max(0, ttl)
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
