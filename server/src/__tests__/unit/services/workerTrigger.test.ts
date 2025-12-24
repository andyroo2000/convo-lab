import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Google Auth - must be before imports
const mockRequest = vi.fn();
const mockGetClient = vi.fn();
const mockGetProjectId = vi.fn();

vi.mock('google-auth-library', () => {
  return {
    GoogleAuth: class {
      getClient = mockGetClient;
      getProjectId = mockGetProjectId;
    }
  };
});

import { triggerWorkerJob } from '../../../services/workerTrigger.js';

describe('Worker Trigger Service - Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Default mock implementations
    mockGetClient.mockResolvedValue({
      request: mockRequest
    });
    mockGetProjectId.mockResolvedValue('test-project');
    mockRequest.mockResolvedValue({ data: { status: 'success' } });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment-Based Behavior', () => {
    it('should skip trigger in development environment', async () => {
      process.env.NODE_ENV = 'development';
      process.env.WORKER_JOB_NAME = 'test-job';

      const consoleSpy = vi.spyOn(console, 'log');

      await triggerWorkerJob();

      expect(consoleSpy).toHaveBeenCalledWith('⏭️  Skipping worker trigger (not in production)');
      expect(mockGetClient).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should skip trigger in test environment', async () => {
      process.env.NODE_ENV = 'test';
      process.env.WORKER_JOB_NAME = 'test-job';

      await triggerWorkerJob();

      expect(mockGetClient).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should trigger in production environment', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'test-job';

      await triggerWorkerJob();

      expect(mockGetClient).toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should log warning when WORKER_JOB_NAME not set in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.WORKER_JOB_NAME;

      const warnSpy = vi.spyOn(console, 'warn');

      await triggerWorkerJob();

      expect(warnSpy).toHaveBeenCalledWith('⚠️  WORKER_JOB_NAME not set, cannot trigger worker job');
      expect(mockGetClient).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should return gracefully when WORKER_JOB_NAME missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.WORKER_JOB_NAME;

      await expect(triggerWorkerJob()).resolves.not.toThrow();
    });
  });

  describe('Google Cloud Run API Calls', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'test-worker-job';
    });

    it('should authenticate with GoogleAuth', async () => {
      await triggerWorkerJob();

      expect(mockGetClient).toHaveBeenCalled();
      expect(mockGetProjectId).toHaveBeenCalled();
    });

    it('should POST to correct Cloud Run URL with default region', async () => {
      delete process.env.WORKER_EXECUTION_REGION;

      await triggerWorkerJob();

      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/test-project/jobs/test-worker-job:run',
        method: 'POST'
      });
    });

    it('should POST to correct Cloud Run URL with custom region', async () => {
      process.env.WORKER_EXECUTION_REGION = 'europe-west1';

      await triggerWorkerJob();

      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://europe-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/test-project/jobs/test-worker-job:run',
        method: 'POST'
      });
    });

    it('should use correct job name from environment variable', async () => {
      process.env.WORKER_JOB_NAME = 'my-custom-worker';

      await triggerWorkerJob();

      const callArg = mockRequest.mock.calls[0][0];
      expect(callArg.url).toContain('my-custom-worker:run');
    });

    it('should log success message when trigger succeeds', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await triggerWorkerJob();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Worker job triggered via API');

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'test-job';
    });

    it('should handle Google Auth failure gracefully', async () => {
      mockGetClient.mockRejectedValue(new Error('Authentication failed'));

      const errorSpy = vi.spyOn(console, 'error');

      await expect(triggerWorkerJob()).resolves.not.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to trigger worker job:',
        'Authentication failed'
      );

      errorSpy.mockRestore();
    });

    it('should handle project ID retrieval failure', async () => {
      mockGetProjectId.mockRejectedValue(new Error('Project ID not found'));

      const errorSpy = vi.spyOn(console, 'error');

      await triggerWorkerJob();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to trigger worker job:',
        'Project ID not found'
      );

      errorSpy.mockRestore();
    });

    it('should handle Cloud Run API 404 (job not found)', async () => {
      const notFoundError = new Error('Job not found');
      (notFoundError as any).code = 404;
      mockRequest.mockRejectedValue(notFoundError);

      const errorSpy = vi.spyOn(console, 'error');

      await triggerWorkerJob();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to trigger worker job:',
        'Job not found'
      );

      errorSpy.mockRestore();
    });

    it('should handle network timeout', async () => {
      mockRequest.mockRejectedValue(new Error('Network timeout'));

      const errorSpy = vi.spyOn(console, 'error');

      await triggerWorkerJob();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to trigger worker job:',
        'Network timeout'
      );

      errorSpy.mockRestore();
    });

    it('should not retry on failure (fire-and-forget pattern)', async () => {
      mockRequest.mockRejectedValue(new Error('API error'));

      await triggerWorkerJob();

      // Should only attempt once
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should complete without blocking caller on error', async () => {
      mockRequest.mockRejectedValue(new Error('Failure'));

      const startTime = Date.now();
      await triggerWorkerJob();
      const duration = Date.now() - startTime;

      // Should complete quickly (not waiting for retries)
      expect(duration).toBeLessThan(100);
    });

    it('should handle permission denied errors', async () => {
      const permError = new Error('Permission denied');
      (permError as any).code = 403;
      mockRequest.mockRejectedValue(permError);

      const errorSpy = vi.spyOn(console, 'error');

      await triggerWorkerJob();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to trigger worker job:',
        'Permission denied'
      );

      errorSpy.mockRestore();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle missing Google credentials gracefully', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'test-job';

      mockGetClient.mockRejectedValue(new Error('Could not load default credentials'));

      await expect(triggerWorkerJob()).resolves.not.toThrow();
    });

    it('should work with minimal environment configuration', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'minimal-job';
      delete process.env.WORKER_EXECUTION_REGION;

      await triggerWorkerJob();

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('us-central1')
        })
      );
    });

    it('should handle special characters in job name', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'worker-job-v2';

      await triggerWorkerJob();

      const url = mockRequest.mock.calls[0][0].url;
      expect(url).toContain('worker-job-v2:run');
    });
  });

  describe('Fire-and-Forget Pattern', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_JOB_NAME = 'test-job';
    });

    it('should await API request completion', async () => {
      // The function does await the request (fire-and-forget at caller level)
      mockRequest.mockResolvedValue({ data: { status: 'success' } });

      await triggerWorkerJob();

      expect(mockRequest).toHaveBeenCalled();
    });

    it('should catch errors without propagating them', async () => {
      mockRequest.mockRejectedValue(new Error('API failure'));

      // Should not throw
      await expect(triggerWorkerJob()).resolves.toBeUndefined();
    });

    it('should return void (undefined)', async () => {
      const result = await triggerWorkerJob();

      expect(result).toBeUndefined();
    });
  });
});
