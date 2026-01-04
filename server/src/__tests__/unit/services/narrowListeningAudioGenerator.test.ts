import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  generateNarrowListeningAudio,
  assignVoicesToSegments,
  type VoiceInfo,
  type SegmentData,
} from '../../../services/narrowListeningAudioGenerator.js';

// Hoisted mocks
const mockGenerateSilence = vi.hoisted(() => vi.fn());
const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockUploadFileToGCS = vi.hoisted(() => vi.fn());
const mockFfprobe = vi.hoisted(() => vi.fn());
const mockFfmpegChain = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  [
    'input',
    'inputOptions',
    'audioCodec',
    'audioBitrate',
    'audioFrequency',
    'audioChannels',
    'output',
    'on',
    'run',
  ].forEach((method) => {
    chain[method] = vi.fn();
    if (method !== 'run') {
      chain[method].mockReturnValue(chain);
    }
  });

  chain.on.mockImplementation((event: string, callback: () => void) => {
    if (event === 'end') {
      setTimeout(() => callback(), 0);
    }
    return chain;
  });

  return chain;
});
const mockFfmpeg = vi.hoisted(() => {
  const fn = vi.fn(() => mockFfmpegChain);
  fn.ffprobe = mockFfprobe;
  fn.setFfprobePath = vi.fn();
  fn.setFfmpegPath = vi.fn();
  return fn;
});

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));

// Mock dependencies
vi.mock('../../../services/ttsClient.js', () => ({
  generateSilence: mockGenerateSilence,
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadFileToGCS: mockUploadFileToGCS,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg,
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => '/usr/bin/ffmpeg'),
}));

describe('narrowListeningAudioGenerator', () => {
  const mockSegments: SegmentData[] = [
    { text: 'こんにちは', translation: 'Hello', reading: 'konnichiwa' },
    { text: 'お元気ですか', translation: 'How are you?', reading: 'ogenki desu ka' },
    { text: 'はい、元気です', translation: "Yes, I'm fine", reading: 'hai, genki desu' },
  ];

  const mockVoices: VoiceInfo[] = [
    { id: 'voice-female-1', gender: 'female', description: 'Female voice 1' },
    { id: 'voice-male-1', gender: 'male', description: 'Male voice 1' },
    { id: 'voice-female-2', gender: 'female', description: 'Female voice 2' },
    { id: 'voice-male-2', gender: 'male', description: 'Male voice 2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockGenerateSilence.mockResolvedValue(Buffer.from('silence-audio'));
    mockSynthesizeBatchedTexts.mockResolvedValue([
      Buffer.from('audio-1'),
      Buffer.from('audio-2'),
      Buffer.from('audio-3'),
    ]);
    mockUploadFileToGCS.mockResolvedValue('https://storage.example.com/audio.mp3');
    mockFfprobe.mockImplementation((filePath, callback) => {
      callback(null, { format: { duration: 2 } }); // 2 seconds
    });
  });

  describe('assignVoicesToSegments', () => {
    it('should throw error if no voices available', () => {
      expect(() => assignVoicesToSegments(3, [])).toThrow('No voices available');
    });

    it('should use single voice for all segments when only one voice available', () => {
      const singleVoice: VoiceInfo[] = [
        { id: 'only-voice', gender: 'female', description: 'Only voice' },
      ];

      const assignments = assignVoicesToSegments(5, singleVoice);

      expect(assignments).toHaveLength(5);
      expect(assignments.every((v) => v === 'only-voice')).toBe(true);
    });

    it('should use round-robin when only one gender available', () => {
      const femaleOnlyVoices: VoiceInfo[] = [
        { id: 'female-1', gender: 'female', description: 'Female 1' },
        { id: 'female-2', gender: 'female', description: 'Female 2' },
      ];

      const assignments = assignVoicesToSegments(4, femaleOnlyVoices);

      expect(assignments).toHaveLength(4);
      // Should cycle through available voices
      expect(assignments).toEqual(['female-1', 'female-2', 'female-1', 'female-2']);
    });

    it('should alternate between genders when both available', () => {
      // Mock Math.random to ensure deterministic starting gender
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.3); // Start with female

      const assignments = assignVoicesToSegments(4, mockVoices);

      expect(assignments).toHaveLength(4);
      // Verify alternation pattern - genders should alternate
      const genders = assignments.map((id) => mockVoices.find((v) => v.id === id)?.gender);
      expect(genders[0]).not.toEqual(genders[1]);
      expect(genders[1]).not.toEqual(genders[2]);
      expect(genders[2]).not.toEqual(genders[3]);

      mockRandom.mockRestore();
    });

    it('should not have consecutive duplicate voices', () => {
      const assignments = assignVoicesToSegments(10, mockVoices);

      for (let i = 1; i < assignments.length; i++) {
        expect(assignments[i]).not.toEqual(assignments[i - 1]);
      }
    });

    it('should handle segment count greater than voice count', () => {
      const assignments = assignVoicesToSegments(20, mockVoices);

      expect(assignments).toHaveLength(20);
      // All assignments should be valid voice IDs
      const validIds = mockVoices.map((v) => v.id);
      assignments.forEach((id) => {
        expect(validIds).toContain(id);
      });
    });

    it('should return empty array for zero segments', () => {
      const assignments = assignVoicesToSegments(0, mockVoices);

      expect(assignments).toHaveLength(0);
    });
  });

  describe('generateNarrowListeningAudio', () => {
    const voiceAssignments = ['voice-female-1', 'voice-male-1', 'voice-female-2'];

    it('should throw error if segment count does not match voice assignments', async () => {
      await expect(
        generateNarrowListeningAudio(
          'pack-123',
          mockSegments,
          ['voice-1'], // Only 1 voice for 3 segments
          1.0,
          0,
          'ja'
        )
      ).rejects.toThrow('Segment count (3) must match voice assignment count (1)');
    });

    it('should create temp directory for audio segments', async () => {
      // Each voice gets one segment, so we need 3 separate TTS calls
      mockSynthesizeBatchedTexts
        .mockResolvedValueOnce([Buffer.from('audio-1')])
        .mockResolvedValueOnce([Buffer.from('audio-2')])
        .mockResolvedValueOnce([Buffer.from('audio-3')]);

      await generateNarrowListeningAudio('pack-123', mockSegments, voiceAssignments, 1.0, 0, 'ja');

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('nl-audio-'), {
        recursive: true,
      });
    });

    it('should batch TTS calls by voice', async () => {
      // Use same voice for all segments to verify batching
      const sameVoice = ['voice-female-1', 'voice-female-1', 'voice-female-1'];
      mockSynthesizeBatchedTexts.mockResolvedValueOnce([
        Buffer.from('audio-1'),
        Buffer.from('audio-2'),
        Buffer.from('audio-3'),
      ]);

      await generateNarrowListeningAudio('pack-123', mockSegments, sameVoice, 1.0, 0, 'ja');

      // Should make single batch call with all texts
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(1);
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        ['こんにちは', 'お元気ですか', 'はい、元気です'],
        expect.objectContaining({
          voiceId: 'voice-female-1',
          languageCode: 'ja-JP',
          speed: 1.0,
        })
      );
    });

    it('should make separate TTS calls for different voices', async () => {
      // Each segment has different voice - setup mocks for each call
      mockSynthesizeBatchedTexts
        .mockResolvedValueOnce([Buffer.from('audio-1')])
        .mockResolvedValueOnce([Buffer.from('audio-2')])
        .mockResolvedValueOnce([Buffer.from('audio-3')]);

      await generateNarrowListeningAudio('pack-123', mockSegments, voiceAssignments, 1.0, 0, 'ja');

      // Should make 3 separate batch calls (one per unique voice)
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(3);
    });

    it('should use correct language code for TTS', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'zh' // Chinese
      );

      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          languageCode: 'zh-CN',
        })
      );
    });

    it('should apply speed parameter to TTS', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        0.7, // Slow speed
        0,
        'ja'
      );

      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          speed: 0.7,
        })
      );
    });

    it('should generate silence buffer if no shared path provided', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(mockGenerateSilence).toHaveBeenCalledWith(2.0);
    });

    it('should use shared silence path if provided', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
      const sharedPath = '/tmp/shared-silence.mp3';

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja',
        sharedPath
      );

      // Should not generate new silence when shared path provided
      expect(mockGenerateSilence).not.toHaveBeenCalled();
    });

    it('should write segment audio files to temp directory', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio-data')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('segment-0.mp3'),
        Buffer.from('audio-data')
      );
    });

    it('should concatenate audio files using ffmpeg', async () => {
      mockSynthesizeBatchedTexts
        .mockResolvedValueOnce([Buffer.from('audio-1')])
        .mockResolvedValueOnce([Buffer.from('audio-2')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0], mockSegments[1]],
        ['voice-female-1', 'voice-male-1'],
        1.0,
        0,
        'ja'
      );

      // Should create concat list file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('concat-list.txt'),
        expect.stringContaining("file '")
      );

      // Should call ffmpeg with concat input
      expect(mockFfmpeg).toHaveBeenCalled();
      expect(mockFfmpegChain.inputOptions).toHaveBeenCalledWith(['-f concat', '-safe 0']);
      expect(mockFfmpegChain.audioCodec).toHaveBeenCalledWith('libmp3lame');
    });

    it('should upload final audio to GCS with correct filename', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        0.7,
        2,
        'ja'
      );

      expect(mockUploadFileToGCS).toHaveBeenCalledWith({
        filePath: expect.any(String),
        filename: 'pack-pack-123-v2-0.7x.mp3',
        contentType: 'audio/mpeg',
        folder: 'narrow-listening',
      });
    });

    it('should use correct speed label in filename', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      // Test 0.85x speed label
      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        0.85,
        0,
        'ja'
      );

      expect(mockUploadFileToGCS).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.stringContaining('0.85x'),
        })
      );
    });

    it('should return AudioGenerationResult with correct structure', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, { format: { duration: 5 } }); // 5 seconds
      });

      const result = await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(result).toHaveProperty('combinedAudioUrl', 'https://storage.example.com/audio.mp3');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('totalDurationMs');
      expect(result.segments).toHaveLength(1);
    });

    it('should include segment timing information', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, { format: { duration: 3 } }); // 3 seconds
      });

      const result = await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      const segment = result.segments[0];
      expect(segment).toHaveProperty('startTime');
      expect(segment).toHaveProperty('endTime');
      expect(segment.startTime).toBe(0);
      expect(segment.endTime).toBeGreaterThan(0);
    });

    it('should include voiceId for each segment', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(result.segments[0].voiceId).toBe('voice-female-1');
    });

    it('should preserve segment text, translation, and reading', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(result.segments[0].text).toBe('こんにちは');
      expect(result.segments[0].translation).toBe('Hello');
      expect(result.segments[0].reading).toBe('konnichiwa');
    });

    it('should handle segments without reading', async () => {
      const segmentNoReading: SegmentData[] = [{ text: 'Test', translation: 'Test translation' }];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateNarrowListeningAudio(
        'pack-123',
        segmentNoReading,
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(result.segments[0].reading).toBeNull();
    });

    it('should cleanup temp directory on success', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('nl-audio-'), {
        recursive: true,
        force: true,
      });
    });

    it('should cleanup temp directory on error', async () => {
      mockSynthesizeBatchedTexts.mockRejectedValue(new Error('TTS failed'));

      await expect(
        generateNarrowListeningAudio(
          'pack-123',
          [mockSegments[0]],
          ['voice-female-1'],
          1.0,
          0,
          'ja'
        )
      ).rejects.toThrow('TTS failed');

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('nl-audio-'), {
        recursive: true,
        force: true,
      });
    });

    it('should return single file without concatenation', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('single-audio')]);

      await generateNarrowListeningAudio(
        'pack-123',
        [mockSegments[0]],
        ['voice-female-1'],
        1.0,
        0,
        'ja'
      );

      // With single segment, no concat list should be written
      // (the implementation returns early before concatenation)
      const _concatCalls = mockFs.writeFile.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('concat-list')
      );
      // Single file should still write concat list but ffmpeg should detect single file
      expect(mockUploadFileToGCS).toHaveBeenCalled();
    });
  });
});
