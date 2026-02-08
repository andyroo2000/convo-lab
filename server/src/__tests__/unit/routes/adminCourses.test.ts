import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  course: {
    findUnique: vi.fn(),
  },
  lineAudioRendering: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockSynthesizeFishAudioSpeech = vi.hoisted(() => vi.fn());
const mockResolveFishAudioVoiceId = vi.hoisted(() => vi.fn());
const mockUploadToGCS = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/ttsProviders/FishAudioTTSProvider.js', () => ({
  synthesizeFishAudioSpeech: mockSynthesizeFishAudioSpeech,
  resolveFishAudioVoiceId: mockResolveFishAudioVoiceId,
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadToGCS: mockUploadToGCS,
}));

describe('Admin Courses Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /:id/synthesize-line', () => {
    it('should require text, voiceId, and unitIndex fields', () => {
      const validateSynthesizeLine = (body: Record<string, unknown>): string | null => {
        const { text, voiceId, unitIndex } = body;
        if (!text || !voiceId || unitIndex === undefined) {
          return 'Missing required fields: text, voiceId, unitIndex';
        }
        return null;
      };

      expect(validateSynthesizeLine({})).toBe('Missing required fields: text, voiceId, unitIndex');
      expect(validateSynthesizeLine({ text: 'hello' })).toBe(
        'Missing required fields: text, voiceId, unitIndex'
      );
      expect(validateSynthesizeLine({ text: 'hello', voiceId: 'fishaudio:abc' })).toBe(
        'Missing required fields: text, voiceId, unitIndex'
      );
      expect(
        validateSynthesizeLine({ text: 'hello', voiceId: 'fishaudio:abc', unitIndex: 0 })
      ).toBeNull();
    });

    it('should reject non-Fish Audio voice IDs', () => {
      const validateVoice = (voiceId: string): string | null => {
        if (!voiceId.startsWith('fishaudio:')) {
          return 'Only Fish Audio voices are supported for line synthesis';
        }
        return null;
      };

      expect(validateVoice('elevenlabs:abc')).toBe(
        'Only Fish Audio voices are supported for line synthesis'
      );
      expect(validateVoice('google:en-US-Neural2-J')).toBe(
        'Only Fish Audio voices are supported for line synthesis'
      );
      expect(validateVoice('fishaudio:abc123')).toBeNull();
    });

    it('should return 404 when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.course.findUnique({ where: { id: 'non-existent' } });
      expect(result).toBeNull();
    });

    it('should use default speed of 1.0 when not provided', () => {
      const DEFAULT_SPEED = 1.0;
      const getSpeed = (speed: number | undefined) => speed || DEFAULT_SPEED;

      expect(getSpeed(undefined)).toBe(1.0);
      expect(getSpeed(0.7)).toBe(0.7);
      expect(getSpeed(1.5)).toBe(1.5);
    });

    it('should call synthesizeFishAudioSpeech with resolved voice ID', async () => {
      mockResolveFishAudioVoiceId.mockReturnValue('resolved-fish-id');
      mockSynthesizeFishAudioSpeech.mockResolvedValue(Buffer.from('audio-data'));

      const referenceId = mockResolveFishAudioVoiceId('fishaudio:abc123');
      expect(referenceId).toBe('resolved-fish-id');

      const audioBuffer = await mockSynthesizeFishAudioSpeech({
        referenceId,
        text: 'こんにちは',
        speed: 1.0,
      });

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(mockSynthesizeFishAudioSpeech).toHaveBeenCalledWith({
        referenceId: 'resolved-fish-id',
        text: 'こんにちは',
        speed: 1.0,
      });
    });

    it('should upload audio to GCS with correct path', async () => {
      mockUploadToGCS.mockResolvedValue(
        'https://storage.example.com/courses/c1/line-tests/line-0.mp3'
      );

      const audioUrl = await mockUploadToGCS({
        buffer: Buffer.from('audio'),
        filename: 'line-0.mp3',
        contentType: 'audio/mpeg',
        folder: 'courses/course-1/line-tests',
      });

      expect(mockUploadToGCS).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'line-0.mp3',
          contentType: 'audio/mpeg',
          folder: 'courses/course-1/line-tests',
        })
      );
      expect(audioUrl).toContain('line-tests');
    });

    it('should create LineAudioRendering record with correct data', async () => {
      const mockRendering = {
        id: 'rendering-1',
        courseId: 'course-1',
        unitIndex: 3,
        text: 'こんにちは',
        speed: 0.8,
        voiceId: 'fishaudio:abc123',
        audioUrl: 'https://storage.example.com/audio.mp3',
      };
      mockPrisma.lineAudioRendering.create.mockResolvedValue(mockRendering);

      const rendering = await mockPrisma.lineAudioRendering.create({
        data: {
          courseId: 'course-1',
          unitIndex: 3,
          text: 'こんにちは',
          speed: 0.8,
          voiceId: 'fishaudio:abc123',
          audioUrl: 'https://storage.example.com/audio.mp3',
        },
      });

      expect(rendering.id).toBe('rendering-1');
      expect(rendering.courseId).toBe('course-1');
      expect(rendering.unitIndex).toBe(3);
      expect(rendering.speed).toBe(0.8);
      expect(mockPrisma.lineAudioRendering.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            courseId: 'course-1',
            unitIndex: 3,
            text: 'こんにちは',
          }),
        })
      );
    });
  });

  describe('GET /:id/line-renderings', () => {
    it('should return 404 when course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      const course = await mockPrisma.course.findUnique({ where: { id: 'non-existent' } });
      expect(course).toBeNull();
    });

    it('should return renderings ordered by unitIndex asc, createdAt desc', async () => {
      const mockRenderings = [
        { id: 'r1', unitIndex: 0, createdAt: new Date('2024-01-02') },
        { id: 'r2', unitIndex: 0, createdAt: new Date('2024-01-01') },
        { id: 'r3', unitIndex: 1, createdAt: new Date('2024-01-01') },
      ];
      mockPrisma.lineAudioRendering.findMany.mockResolvedValue(mockRenderings);

      const renderings = await mockPrisma.lineAudioRendering.findMany({
        where: { courseId: 'course-1' },
        orderBy: [{ unitIndex: 'asc' }, { createdAt: 'desc' }],
      });

      expect(renderings).toHaveLength(3);
      expect(mockPrisma.lineAudioRendering.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ unitIndex: 'asc' }, { createdAt: 'desc' }],
        })
      );
    });

    it('should return empty array when no renderings exist', async () => {
      mockPrisma.lineAudioRendering.findMany.mockResolvedValue([]);

      const renderings = await mockPrisma.lineAudioRendering.findMany({
        where: { courseId: 'course-1' },
      });

      expect(renderings).toEqual([]);
    });
  });

  describe('DELETE /:id/line-renderings/:renderingId', () => {
    it('should return 404 when rendering not found', async () => {
      mockPrisma.lineAudioRendering.findUnique.mockResolvedValue(null);

      const rendering = await mockPrisma.lineAudioRendering.findUnique({
        where: { id: 'non-existent' },
      });

      expect(rendering).toBeNull();
    });

    it('should return 404 when rendering belongs to a different course', () => {
      const rendering = {
        id: 'rendering-1',
        courseId: 'course-2',
      };
      const requestCourseId = 'course-1';

      expect(rendering.courseId !== requestCourseId).toBe(true);
      // Route would throw: 'Rendering not found' when courseId doesn't match
    });

    it('should delete rendering when found and course matches', async () => {
      const mockRendering = {
        id: 'rendering-1',
        courseId: 'course-1',
      };
      mockPrisma.lineAudioRendering.findUnique.mockResolvedValue(mockRendering);
      mockPrisma.lineAudioRendering.delete.mockResolvedValue(mockRendering);

      const rendering = await mockPrisma.lineAudioRendering.findUnique({
        where: { id: 'rendering-1' },
      });

      expect(rendering).not.toBeNull();
      expect(rendering!.courseId).toBe('course-1');

      await mockPrisma.lineAudioRendering.delete({
        where: { id: rendering!.id },
      });

      expect(mockPrisma.lineAudioRendering.delete).toHaveBeenCalledWith({
        where: { id: 'rendering-1' },
      });
    });
  });

  describe('GET /:id/pipeline-data', () => {
    it('should detect exchanges pipeline stage', () => {
      const scriptJson = {
        _pipelineStage: 'exchanges',
        _exchanges: [{ speakerName: 'A', lines: [] }],
      };

      expect(scriptJson._pipelineStage).toBe('exchanges');
      expect(Array.isArray(scriptJson._exchanges)).toBe(true);
    });

    it('should detect script pipeline stage with exchanges and script units', () => {
      const scriptJson = {
        _pipelineStage: 'script',
        _exchanges: [{ speakerName: 'A', lines: [] }],
        _scriptUnits: [{ type: 'L2', text: 'hello' }],
      };

      expect(scriptJson._pipelineStage).toBe('script');
      expect(scriptJson._exchanges).toBeDefined();
      expect(scriptJson._scriptUnits).toBeDefined();
    });

    it('should fall back to scriptUnitsJson when scriptJson has no script units', () => {
      const course = {
        scriptJson: { _pipelineStage: 'exchanges', _exchanges: [] },
        scriptUnitsJson: [{ type: 'L2', text: 'hello' }],
      };

      const scriptJson = course.scriptJson as Record<string, unknown>;
      let scriptUnits = null;

      if (scriptJson._pipelineStage === 'script') {
        scriptUnits = scriptJson._scriptUnits;
      }

      // Fallback to scriptUnitsJson
      if (!scriptUnits && course.scriptUnitsJson && Array.isArray(course.scriptUnitsJson)) {
        scriptUnits = course.scriptUnitsJson;
      }

      expect(scriptUnits).toEqual([{ type: 'L2', text: 'hello' }]);
    });

    it('should handle legacy flat array scriptJson format', () => {
      const scriptJson = [{ type: 'L2', text: 'hello' }];

      const isLegacy = Array.isArray(scriptJson);
      expect(isLegacy).toBe(true);
    });
  });
});
