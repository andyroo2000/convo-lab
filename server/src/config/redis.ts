import { Redis } from 'ioredis';

/**
 * Shared Redis connection configuration for API rate limiting.
 * Automatically enables TLS when using Upstash (host contains 'upstash.io')
 * For self-hosted Redis, connects without TLS on internal Docker network
 */
export const createRedisConnection = () =>
  new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    // Enable TLS for Upstash
    tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
  });
