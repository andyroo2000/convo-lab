import { Redis } from 'ioredis';
import { WorkerOptions } from 'bullmq';

/**
 * Shared Redis connection configuration for job queues
 * Optimized to stay under Upstash free tier (10k requests/day limit)
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

/**
 * Shared worker settings optimized for minimal Redis usage
 * These settings dramatically reduce polling frequency to conserve requests
 * Note: connection should be provided by each worker individually
 */
export const defaultWorkerSettings: Partial<WorkerOptions> = {
  autorun: true,
  concurrency: 1,

  // Reduce polling frequency for idle workers - THE KEY SETTINGS TO REDUCE REDIS USAGE
  lockDuration: 300000, // 5 minutes - how long a job is locked during processing (must be longer than longest job)
  drainDelay: parseInt(process.env.WORKER_DRAIN_DELAY || '30000'), // Delay before checking for new jobs when queue is empty
  // Examples:
  // 5000 (5s) = fast for testing, ~103K cmds/day (~$15/mo)
  // 30000 (30s) = balanced, ~17K cmds/day (~$3-5/mo)
  // 60000 (60s) = efficient, ~8.6K cmds/day (free tier)
  // 300000 (5min) = idle mode, ~1.7K cmds/day (minimal cost)

  // Rate limiter for job processing (doesn't affect idle polling)
  limiter: {
    max: 10, // Process max 10 jobs
    duration: 1000, // per second
  },
};
