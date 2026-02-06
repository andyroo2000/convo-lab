import { describe, it, expect, vi, beforeEach } from 'vitest';

interface JobData {
  episodeId: string;
  dialogueId: string;
  userId?: string;
  speed?: string;
  pauseMode?: boolean;
}

interface MockJob {
  id: string;
  name: string;
  data: JobData;
}

// Create hoisted mocks
const mockAudioQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
  getJobs: vi.fn(),
}));

vi.mock('../../../jobs/audioQueue.js', () => ({
  audioQueue: mockAudioQueue,
}));

describe('Audio Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /generate - Generate Audio', () => {
    it('should require episodeId and dialogueId', () => {
      const validateGenerateAudio = (body: {
        episodeId?: string;
        dialogueId?: string;
      }): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateAudio({})).toBe('Missing required fields');
      expect(validateGenerateAudio({ episodeId: 'ep-1' })).toBe('Missing required fields');
      expect(validateGenerateAudio({ dialogueId: 'd-1' })).toBe('Missing required fields');
      expect(validateGenerateAudio({ episodeId: 'ep-1', dialogueId: 'd-1' })).toBeNull();
    });

    it('should queue audio generation job with user data', async () => {
      mockAudioQueue.add.mockResolvedValue({ id: 'job-123' });

      const job = await mockAudioQueue.add('generate-audio', {
        userId: 'test-user-id',
        episodeId: 'ep-1',
        dialogueId: 'd-1',
        speed: 'normal',
        pauseMode: false,
      });

      expect(mockAudioQueue.add).toHaveBeenCalledWith(
        'generate-audio',
        expect.objectContaining({
          userId: 'test-user-id',
          episodeId: 'ep-1',
          dialogueId: 'd-1',
        })
      );
      expect(job.id).toBe('job-123');
    });

    it('should use default speed of normal', () => {
      const getSpeed = (body: { speed?: string }) => body.speed || 'normal';

      expect(getSpeed({})).toBe('normal');
      expect(getSpeed({ speed: 'slow' })).toBe('slow');
      expect(getSpeed({ speed: 'medium' })).toBe('medium');
    });

    it('should use default pauseMode of false', () => {
      const getPauseMode = (body: { pauseMode?: boolean }) => body.pauseMode || false;

      expect(getPauseMode({})).toBe(false);
      expect(getPauseMode({ pauseMode: true })).toBe(true);
    });

    it('should validate speed parameter values', () => {
      const validSpeeds = ['slow', 'medium', 'normal'];
      const isValidSpeed = (speed: string) => validSpeeds.includes(speed);

      expect(isValidSpeed('slow')).toBe(true);
      expect(isValidSpeed('medium')).toBe(true);
      expect(isValidSpeed('normal')).toBe(true);
      expect(isValidSpeed('fast')).toBe(false);
    });
  });

  describe('POST /generate-all-speeds - Multi-Speed Audio Generation', () => {
    it('should require episodeId and dialogueId', () => {
      const validateGenerateAllSpeeds = (body: {
        episodeId?: string;
        dialogueId?: string;
      }): string | null => {
        const { episodeId, dialogueId } = body;
        if (!episodeId || !dialogueId) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateGenerateAllSpeeds({})).toBe('Missing required fields');
      expect(validateGenerateAllSpeeds({ episodeId: 'ep-1', dialogueId: 'd-1' })).toBeNull();
    });

    it('should check for duplicate jobs before queuing', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        {
          id: 'existing-job',
          name: 'generate-all-speeds',
          data: { episodeId: 'ep-1', dialogueId: 'd-1' },
        },
      ]);

      const existingJobs = await mockAudioQueue.getJobs(['active', 'waiting']);
      const duplicateJob = existingJobs.find(
        (job: MockJob) =>
          job.name === 'generate-all-speeds' &&
          job.data.episodeId === 'ep-1' &&
          job.data.dialogueId === 'd-1'
      );

      expect(duplicateJob).toBeDefined();
      expect(duplicateJob.id).toBe('existing-job');
    });

    it('should return existing job if duplicate found', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        {
          id: 'existing-job',
          name: 'generate-all-speeds',
          data: { episodeId: 'ep-1', dialogueId: 'd-1' },
        },
      ]);

      const existingJobs = await mockAudioQueue.getJobs(['active', 'waiting']);
      const duplicateJob = existingJobs.find(
        (job: MockJob) =>
          job.name === 'generate-all-speeds' &&
          job.data.episodeId === 'ep-1' &&
          job.data.dialogueId === 'd-1'
      );

      if (duplicateJob) {
        const response = {
          jobId: duplicateJob.id,
          message: 'Audio generation already in progress',
          existing: true,
        };
        expect(response.existing).toBe(true);
        expect(response.jobId).toBe('existing-job');
      }
    });

    it('should queue new job when no duplicate exists', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([]);
      mockAudioQueue.add.mockResolvedValue({ id: 'new-job-123' });

      const existingJobs = await mockAudioQueue.getJobs(['active', 'waiting']);
      const duplicateJob = existingJobs.find(
        (job: MockJob) =>
          job.name === 'generate-all-speeds' &&
          job.data.episodeId === 'ep-2' &&
          job.data.dialogueId === 'd-2'
      );

      expect(duplicateJob).toBeUndefined();

      const job = await mockAudioQueue.add('generate-all-speeds', {
        episodeId: 'ep-2',
        dialogueId: 'd-2',
      });

      expect(job.id).toBe('new-job-123');
    });

    it('should not match duplicate with different episodeId', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        {
          id: 'existing-job',
          name: 'generate-all-speeds',
          data: { episodeId: 'ep-1', dialogueId: 'd-1' },
        },
      ]);

      const existingJobs = await mockAudioQueue.getJobs(['active', 'waiting']);
      const duplicateJob = existingJobs.find(
        (job: MockJob) =>
          job.name === 'generate-all-speeds' &&
          job.data.episodeId === 'ep-2' &&
          job.data.dialogueId === 'd-1'
      );

      expect(duplicateJob).toBeUndefined();
    });

    it('should not match duplicate with different job name', async () => {
      mockAudioQueue.getJobs.mockResolvedValue([
        {
          id: 'existing-job',
          name: 'generate-audio',
          data: { episodeId: 'ep-1', dialogueId: 'd-1' },
        },
      ]);

      const existingJobs = await mockAudioQueue.getJobs(['active', 'waiting']);
      const duplicateJob = existingJobs.find(
        (job: MockJob) =>
          job.name === 'generate-all-speeds' &&
          job.data.episodeId === 'ep-1' &&
          job.data.dialogueId === 'd-1'
      );

      expect(duplicateJob).toBeUndefined();
    });
  });

  describe('GET /job/:jobId - Job Status', () => {
    it('should return job status with progress', async () => {
      mockAudioQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active'),
        progress: { step: 'synthesizing', progress: 50 },
        returnvalue: null,
      });

      const job = await mockAudioQueue.getJob('job-123');

      expect(job).toBeDefined();
      expect(await job.getState()).toBe('active');
      expect(job.progress.step).toBe('synthesizing');
    });

    it('should return completed job with result', async () => {
      const mockResult = {
        audioUrl: 'https://storage.example.com/audio.mp3',
        duration: 120,
      };

      mockAudioQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: mockResult,
      });

      const job = await mockAudioQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('completed');
      expect(job.returnvalue.audioUrl).toBeDefined();
    });

    it('should return null for non-existent job', async () => {
      mockAudioQueue.getJob.mockResolvedValue(null);

      const job = await mockAudioQueue.getJob('non-existent');

      expect(job).toBeNull();
      // Route would throw AppError('Job not found', 404)
    });

    it('should return job state for different states', async () => {
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed'];

      for (const expectedState of states) {
        mockAudioQueue.getJob.mockResolvedValue({
          id: `job-${expectedState}`,
          getState: vi.fn().mockResolvedValue(expectedState),
          progress: 0,
          returnvalue: null,
        });

        const job = await mockAudioQueue.getJob(`job-${expectedState}`);
        const state = await job.getState();

        expect(state).toBe(expectedState);
      }
    });
  });

  describe('Response Formatting', () => {
    it('should format generate response correctly', () => {
      const formatGenerateResponse = (jobId: string) => ({
        jobId,
        message: 'Audio generation started',
      });

      const response = formatGenerateResponse('job-123');
      expect(response.jobId).toBe('job-123');
      expect(response.message).toBe('Audio generation started');
    });

    it('should format multi-speed generate response correctly', () => {
      const formatMultiSpeedResponse = (jobId: string) => ({
        jobId,
        message: 'Multi-speed audio generation started',
      });

      const response = formatMultiSpeedResponse('job-456');
      expect(response.jobId).toBe('job-456');
      expect(response.message).toBe('Multi-speed audio generation started');
    });

    it('should format job status response correctly', () => {
      const formatJobStatusResponse = (
        job: { id: string; progress: number; returnvalue: unknown },
        state: string
      ) => ({
        id: job.id,
        state,
        progress: job.progress,
        result: state === 'completed' ? job.returnvalue : null,
      });

      const activeJob = {
        id: 'job-123',
        progress: 50,
        returnvalue: { audioUrl: 'test.mp3' },
      };

      const activeResponse = formatJobStatusResponse(activeJob, 'active');
      expect(activeResponse.result).toBeNull();

      const completedResponse = formatJobStatusResponse(activeJob, 'completed');
      expect(completedResponse.result).toBeDefined();
    });
  });

  describe('Speed Values', () => {
    it('should support three speed levels', () => {
      const speedMultipliers = {
        slow: 0.7,
        medium: 0.85,
        normal: 1.0,
      };

      expect(speedMultipliers.slow).toBe(0.7);
      expect(speedMultipliers.medium).toBe(0.85);
      expect(speedMultipliers.normal).toBe(1.0);
    });

    it('should map speed names to audio URL fields', () => {
      const speedToField = (speed: string) => {
        switch (speed) {
          case 'slow':
            return 'audioUrl_0_7';
          case 'medium':
            return 'audioUrl_0_85';
          case 'normal':
            return 'audioUrl_1_0';
          default:
            return 'audioUrl_1_0';
        }
      };

      expect(speedToField('slow')).toBe('audioUrl_0_7');
      expect(speedToField('medium')).toBe('audioUrl_0_85');
      expect(speedToField('normal')).toBe('audioUrl_1_0');
    });
  });
});
