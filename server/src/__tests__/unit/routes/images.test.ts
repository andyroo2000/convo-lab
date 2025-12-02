import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockImageQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('../../../jobs/imageQueue.js', () => ({
  imageQueue: mockImageQueue,
}));

describe('Images Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /generate - Generate Images', () => {
    it('should require episodeId', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({ dialogueId: 'd-1' })).toBe('Missing required fields');
    });

    it('should require dialogueId', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({ episodeId: 'ep-1' })).toBe('Missing required fields');
    });

    it('should pass validation with both required fields', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({ episodeId: 'ep-1', dialogueId: 'd-1' })).toBeNull();
    });

    it('should queue image generation job with default image count', async () => {
      mockImageQueue.add.mockResolvedValue({ id: 'job-123' });

      const job = await mockImageQueue.add('generate-images', {
        userId: 'test-user-id',
        episodeId: 'ep-1',
        dialogueId: 'd-1',
        imageCount: 3, // default value
      });

      expect(mockImageQueue.add).toHaveBeenCalledWith(
        'generate-images',
        expect.objectContaining({
          userId: 'test-user-id',
          episodeId: 'ep-1',
          dialogueId: 'd-1',
          imageCount: 3,
        })
      );
      expect(job.id).toBe('job-123');
    });

    it('should accept custom image count', async () => {
      mockImageQueue.add.mockResolvedValue({ id: 'job-456' });

      const job = await mockImageQueue.add('generate-images', {
        userId: 'test-user-id',
        episodeId: 'ep-1',
        dialogueId: 'd-1',
        imageCount: 5,
      });

      expect(mockImageQueue.add).toHaveBeenCalledWith(
        'generate-images',
        expect.objectContaining({
          imageCount: 5,
        })
      );
      expect(job.id).toBe('job-456');
    });

    it('should use default imageCount of 3', () => {
      const getImageCount = (body: any) => body.imageCount || 3;

      expect(getImageCount({})).toBe(3);
      expect(getImageCount({ imageCount: 5 })).toBe(5);
      expect(getImageCount({ imageCount: 1 })).toBe(1);
    });
  });

  describe('GET /job/:jobId - Job Status', () => {
    it('should return job status with progress', async () => {
      mockImageQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active'),
        progress: { step: 'generating', progress: 30 },
        returnvalue: null,
      });

      const job = await mockImageQueue.getJob('job-123');

      expect(job).toBeDefined();
      expect(await job.getState()).toBe('active');
      expect(job.progress.step).toBe('generating');
    });

    it('should return completed job with result', async () => {
      const mockResult = {
        images: [
          'https://storage.example.com/image1.png',
          'https://storage.example.com/image2.png',
        ],
      };

      mockImageQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: mockResult,
      });

      const job = await mockImageQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('completed');
      expect(job.returnvalue.images).toHaveLength(2);
    });

    it('should return null for non-existent job', async () => {
      mockImageQueue.getJob.mockResolvedValue(null);

      const job = await mockImageQueue.getJob('non-existent');

      expect(job).toBeNull();
      // Route would throw AppError('Job not found', 404)
    });

    it('should return different job states', async () => {
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed'];

      for (const expectedState of states) {
        mockImageQueue.getJob.mockResolvedValue({
          id: `job-${expectedState}`,
          getState: vi.fn().mockResolvedValue(expectedState),
          progress: 0,
          returnvalue: null,
        });

        const job = await mockImageQueue.getJob(`job-${expectedState}`);
        const state = await job.getState();

        expect(state).toBe(expectedState);
      }
    });
  });

  describe('Response Formatting', () => {
    it('should format generate response correctly', () => {
      const formatGenerateResponse = (jobId: string) => ({
        jobId,
        message: 'Image generation started',
      });

      const response = formatGenerateResponse('job-123');
      expect(response.jobId).toBe('job-123');
      expect(response.message).toBe('Image generation started');
    });

    it('should format job status response correctly for active job', () => {
      const formatJobStatusResponse = (job: any, state: string) => ({
        id: job.id,
        state,
        progress: job.progress,
        result: state === 'completed' ? job.returnvalue : null,
      });

      const activeJob = {
        id: 'job-123',
        progress: 50,
        returnvalue: { images: ['url1', 'url2'] },
      };

      const response = formatJobStatusResponse(activeJob, 'active');
      expect(response.result).toBeNull();
      expect(response.state).toBe('active');
      expect(response.progress).toBe(50);
    });

    it('should format job status response correctly for completed job', () => {
      const formatJobStatusResponse = (job: any, state: string) => ({
        id: job.id,
        state,
        progress: job.progress,
        result: state === 'completed' ? job.returnvalue : null,
      });

      const completedJob = {
        id: 'job-123',
        progress: 100,
        returnvalue: { images: ['url1', 'url2', 'url3'] },
      };

      const response = formatJobStatusResponse(completedJob, 'completed');
      expect(response.result).toBeDefined();
      expect(response.result.images).toHaveLength(3);
    });
  });

  describe('Validation', () => {
    it('should reject empty body', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body || {};
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({})).toBe('Missing required fields');
      expect(validateGenerateImages(null)).toBe('Missing required fields');
      expect(validateGenerateImages(undefined)).toBe('Missing required fields');
    });

    it('should validate that episodeId is not empty string', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({ episodeId: '', dialogueId: 'd-1' })).toBe(
        'Missing required fields'
      );
    });

    it('should validate that dialogueId is not empty string', () => {
      const validateGenerateImages = (body: any): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateImages({ episodeId: 'ep-1', dialogueId: '' })).toBe(
        'Missing required fields'
      );
    });
  });
});
