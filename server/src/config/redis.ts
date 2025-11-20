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
 */
export const defaultWorkerSettings: Partial<WorkerOptions> = {
  connection: createRedisConnection(),
  // Use longer polling intervals to reduce Redis requests
  autorun: true,
  // Limit concurrent jobs to reduce active polling
  concurrency: 1,
  // Add explicit polling interval to reduce idle Redis usage
  limiter: {
    max: 10, // Process max 10 jobs
    duration: 1000, // per second
  },
};
