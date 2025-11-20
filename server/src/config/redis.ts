import { Redis } from 'ioredis';
import { WorkerOptions } from 'bullmq';

/**
 * Shared Redis connection configuration for job queues
 * Optimized to minimize requests on Upstash free tier (500k/month limit)
 */
export const createRedisConnection = () => new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  // Enable TLS for Upstash
  tls: process.env.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
});

/**
 * Shared worker settings optimized for minimal Redis usage
 * These settings dramatically reduce polling frequency to conserve requests
 * Note: connection should be provided by each worker individually
 */
export const defaultWorkerSettings: Partial<WorkerOptions> = {
  autorun: true,
  concurrency: 1,

  // Reduce polling frequency for idle workers - THE KEY SETTINGS TO REDUCE REDIS USAGE
  lockDuration: 30000,  // 30 seconds - how long a job is locked during processing
  drainDelay: 5000,     // 5 seconds - delay before checking for new jobs when queue is empty

  // Rate limiter for job processing (doesn't affect idle polling)
  limiter: {
    max: 10,           // Process max 10 jobs
    duration: 1000,    // per second
  },
};
