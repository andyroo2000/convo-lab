import { RedisOptions } from 'ioredis';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createRedisConnection } from '../../../config/redis.js';

// Mock ioredis
const mockRedisInstance = vi.fn();
vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(function (
    this: { config: RedisOptions; disconnect: () => void },
    config: RedisOptions
  ) {
    this.config = config;
    this.disconnect = vi.fn();
    mockRedisInstance(config);
    return this;
  }),
}));

describe('Redis Configuration - Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createRedisConnection', () => {
    it('should create Redis connection with default localhost settings', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;

      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          password: undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          enableOfflineQueue: true,
        })
      );
    });

    it('should use environment variables for connection', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret-password';

      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret-password',
        })
      );
    });

    it('should enable TLS for Upstash hosts', () => {
      process.env.REDIS_HOST = 'my-redis.upstash.io';

      createRedisConnection();

      const callArg = mockRedisInstance.mock.calls[0][0];
      expect(callArg.tls).toEqual({});
    });

    it('should not enable TLS for non-Upstash hosts', () => {
      process.env.REDIS_HOST = 'redis.amazonaws.com';

      createRedisConnection();

      const callArg = mockRedisInstance.mock.calls[0][0];
      expect(callArg.tls).toBeUndefined();
    });

    it('should not enable TLS for localhost', () => {
      process.env.REDIS_HOST = 'localhost';

      createRedisConnection();

      const callArg = mockRedisInstance.mock.calls[0][0];
      expect(callArg.tls).toBeUndefined();
    });

    it('should allow blocking rate-limit commands without a retry cap', () => {
      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetriesPerRequest: null,
        })
      );
    });

    it('should enable offline queue for resilience', () => {
      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          enableOfflineQueue: true,
        })
      );
    });

    it('should disable ready check for faster startup', () => {
      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          enableReadyCheck: false,
        })
      );
    });

    it('should handle invalid port number gracefully', () => {
      process.env.REDIS_PORT = 'invalid';

      createRedisConnection();

      const callArg = mockRedisInstance.mock.calls[0][0];
      expect(callArg.port).toBeNaN();
    });

    it('should create multiple independent connections', () => {
      const conn1 = createRedisConnection();
      const conn2 = createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledTimes(2);
      expect(conn1).not.toBe(conn2);
    });
  });

  describe('Connection Lifecycle', () => {
    it('should allow disconnect to be called', () => {
      const connection = createRedisConnection();

      expect(connection.disconnect).toBeDefined();
      expect(typeof connection.disconnect).toBe('function');
    });

    it('should handle disconnect idempotently', () => {
      const connection = createRedisConnection();

      connection.disconnect();
      connection.disconnect();

      // Should not throw
      expect(connection.disconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Upstash Optimization', () => {
    it('should detect Upstash hosts correctly', () => {
      const testCases = [
        { host: 'my-redis.upstash.io', expectTLS: true },
        { host: 'example.upstash.io', expectTLS: true },
        { host: 'redis.com', expectTLS: false },
        { host: 'localhost', expectTLS: false },
        { host: 'upstash.io.evil.com', expectTLS: true }, // Current implementation uses includes() - matches any substring
      ];

      testCases.forEach(({ host, expectTLS }) => {
        vi.clearAllMocks();
        process.env.REDIS_HOST = host;

        createRedisConnection();

        const callArg = mockRedisInstance.mock.calls[0][0];
        if (expectTLS) {
          expect(callArg.tls).toEqual({});
        } else {
          expect(callArg.tls).toBeUndefined();
        }
      });
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse valid numeric port', () => {
      process.env.REDIS_PORT = '1234';

      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(expect.objectContaining({ port: 1234 }));
    });

    it('should handle empty string port', () => {
      process.env.REDIS_PORT = '';

      createRedisConnection();

      // Empty string is treated as falsy, falls back to default 6379
      const callArg = mockRedisInstance.mock.calls[0][0];
      expect(callArg.port).toBe(6379);
    });

    it('should handle undefined password gracefully', () => {
      delete process.env.REDIS_PASSWORD;

      createRedisConnection();

      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({ password: undefined })
      );
    });

    it('should treat empty string password as undefined', () => {
      process.env.REDIS_PASSWORD = '';

      createRedisConnection();

      // Empty string is treated as falsy, becomes undefined
      expect(mockRedisInstance).toHaveBeenCalledWith(
        expect.objectContaining({ password: undefined })
      );
    });
  });
});
