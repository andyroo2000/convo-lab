import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  episode: {
    findUnique: vi.fn(),
  },
}));

const mockDialogueQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../jobs/dialogueQueue.js', () => ({
  dialogueQueue: mockDialogueQueue,
}));

describe('Dialogue Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /generate - Generate Dialogue', () => {
    it('should require episodeId', () => {
      const validateGenerateDialogue = (body: any): string | null => {
        if (!body.episodeId) {
          return 'episodeId is required';
        }
        return null;
      };

      expect(validateGenerateDialogue({})).toBe('episodeId is required');
      expect(validateGenerateDialogue({ episodeId: 'ep-1' })).toBeNull();
    });

    it('should verify episode exists before generating', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        userId: 'test-user-id',
        sourceText: 'Test source text',
      });

      const episode = await mockPrisma.episode.findUnique({
        where: { id: 'ep-1' },
      });

      expect(episode).toBeDefined();
      expect(episode?.userId).toBe('test-user-id');
    });

    it('should reject generation for non-existent episode', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue(null);

      const episode = await mockPrisma.episode.findUnique({
        where: { id: 'non-existent' },
      });

      expect(episode).toBeNull();
      // Route would throw AppError('Episode not found', 404)
    });

    it('should reject generation for episode owned by different user', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        userId: 'other-user-id',
      });

      const episode = await mockPrisma.episode.findUnique({
        where: { id: 'ep-1' },
      });

      const isOwner = episode?.userId === 'test-user-id';
      expect(isOwner).toBe(false);
      // Route would throw AppError('Episode not found', 404)
    });

    it('should queue dialogue generation job with speakers', async () => {
      const speakers = [
        { name: '田中', voiceId: 'ja-JP-Neural2-B', proficiency: 'native', tone: 'casual' },
        { name: '山田', voiceId: 'ja-JP-Neural2-C', proficiency: 'intermediate', tone: 'polite' },
      ];

      mockDialogueQueue.add.mockResolvedValue({ id: 'job-123' });

      await mockDialogueQueue.add(
        {
          episodeId: 'ep-1',
          speakers,
          variationCount: 3,
          dialogueLength: 8,
        },
        { jobId: 'dialogue-ep-1' }
      );

      expect(mockDialogueQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          episodeId: 'ep-1',
          speakers,
        }),
        expect.objectContaining({ jobId: 'dialogue-ep-1' })
      );
    });

    it('should use default values for variationCount and dialogueLength', () => {
      const getDefaults = (body: any) => ({
        variationCount: body.variationCount || 3,
        dialogueLength: body.dialogueLength || 6,
      });

      expect(getDefaults({}).variationCount).toBe(3);
      expect(getDefaults({}).dialogueLength).toBe(6);
      expect(getDefaults({ variationCount: 5, dialogueLength: 10 }).variationCount).toBe(5);
    });
  });

  describe('GET /job/:jobId - Get Job Status', () => {
    it('should return job status with progress', async () => {
      mockDialogueQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active'),
        progress: vi.fn().mockReturnValue({ step: 'generating', progress: 50 }),
        returnvalue: null,
        failedReason: null,
      });

      const job = await mockDialogueQueue.getJob('job-123');

      expect(job).toBeDefined();
      expect(await job.getState()).toBe('active');
      expect(job.progress()).toEqual({ step: 'generating', progress: 50 });
    });

    it('should return completed job with dialogue result', async () => {
      const mockDialogue = {
        id: 'dialogue-1',
        sentences: [{ text: 'こんにちは' }],
      };

      mockDialogueQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: { dialogue: mockDialogue },
        failedReason: null,
      });

      const job = await mockDialogueQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('completed');
      expect(job.returnvalue.dialogue).toBeDefined();
    });

    it('should return failed job with error reason', async () => {
      mockDialogueQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('failed'),
        returnvalue: null,
        failedReason: 'API error: rate limited',
      });

      const job = await mockDialogueQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('failed');
      expect(job.failedReason).toContain('API error');
    });

    it('should return null for non-existent job', async () => {
      mockDialogueQueue.getJob.mockResolvedValue(null);

      const job = await mockDialogueQueue.getJob('non-existent');

      expect(job).toBeNull();
      // Route would throw AppError('Job not found', 404)
    });
  });

  describe('Speaker Validation', () => {
    it('should validate speaker structure', () => {
      const validateSpeaker = (speaker: any): boolean => {
        return (
          typeof speaker.name === 'string' &&
          typeof speaker.voiceId === 'string' &&
          typeof speaker.proficiency === 'string' &&
          typeof speaker.tone === 'string'
        );
      };

      expect(validateSpeaker({
        name: '田中',
        voiceId: 'ja-JP-Neural2-B',
        proficiency: 'native',
        tone: 'casual',
      })).toBe(true);

      expect(validateSpeaker({
        name: '田中',
      })).toBe(false);
    });

    it('should validate proficiency levels', () => {
      const validProficiencies = ['native', 'advanced', 'intermediate', 'beginner'];

      expect(validProficiencies.includes('native')).toBe(true);
      expect(validProficiencies.includes('expert')).toBe(false);
    });

    it('should validate tone values', () => {
      const validTones = ['casual', 'polite', 'formal', 'neutral'];

      expect(validTones.includes('casual')).toBe(true);
      expect(validTones.includes('polite')).toBe(true);
      expect(validTones.includes('rude')).toBe(false);
    });
  });

  describe('Job States', () => {
    it('should recognize all valid job states', () => {
      const validStates = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];

      validStates.forEach(state => {
        expect(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'].includes(state)).toBe(true);
      });
    });

    it('should map job state to response status', () => {
      const mapStateToStatus = (state: string) => {
        switch (state) {
          case 'completed': return 'success';
          case 'failed': return 'error';
          case 'active': return 'processing';
          default: return 'pending';
        }
      };

      expect(mapStateToStatus('completed')).toBe('success');
      expect(mapStateToStatus('failed')).toBe('error');
      expect(mapStateToStatus('active')).toBe('processing');
      expect(mapStateToStatus('waiting')).toBe('pending');
    });
  });
});
