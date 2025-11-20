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
  settings: {
    // Drastically reduce stalled job checking to minimize Redis requests
    stalledInterval: 300000, // Check for stalled jobs every 5 minutes (default: 30s)
    maxStalledCount: 1,
    // Reduce lock renewal frequency
    lockDuration: 60000, // 1 minute (default: 30s)
    lockRenewTime: 30000, // Renew at 30s (default: 15s)
  },
  // Use longer polling intervals to reduce Redis requests
  autorun: true,
  // Limit concurrent jobs to reduce active polling
  concurrency: 1,
};
