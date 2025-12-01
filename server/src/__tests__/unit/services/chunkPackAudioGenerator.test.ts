import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockGenerateSilence = vi.hoisted(() => vi.fn());
const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockUploadToGCS = vi.hoisted(() => vi.fn());
const mockFfprobe = vi.hoisted(() => vi.fn());
const mockFfmpegChain = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  ['input', 'inputOptions', 'audioCodec', 'audioBitrate', 'audioFrequency', 'audioChannels', 'output', 'on', 'run', 'mergeToFile'].forEach(method => {
    chain[method] = vi.fn();
    if (method !== 'run' && method !== 'mergeToFile') {
      chain[method].mockReturnValue(chain);
    }
  });

  chain.on.mockImplementation((event: string, callback: () => void) => {
    if (event === 'end') {
      setTimeout(() => callback(), 0);
    }
    return chain;
  });

  chain.mergeToFile.mockImplementation(() => {
    const onHandler = chain.on.mock.calls.find((call: unknown[]) => call[0] === 'end');
    if (onHandler) {
      setTimeout(() => onHandler[1](), 0);
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
  readFile: vi.fn(),
}));

// Mock dependencies
vi.mock('../../../services/ttsClient.js', () => ({
  generateSilence: mockGenerateSilence,
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadToGCS: mockUploadToGCS,
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

// Mock shared constants
vi.mock('../../../../../shared/src/constants-new.js', () => ({
  TTS_VOICES: {
    ja: {
      voices: [
        { id: 'ja-JP-Neural2-B', gender: 'male' },
        { id: 'ja-JP-Neural2-C', gender: 'female' },
        { id: 'ja-JP-Neural2-D', gender: 'male' },
      ],
    },
  },
}));

// Import after mocking
import {
  generateExampleAudio,
  generateStoryAudio,
  generateExerciseAudio,
} from '../../../services/chunkPackAudioGenerator.js';
import type { ChunkExampleData, ChunkStorySegmentData, ChunkExerciseData } from '../../../types/chunkPack.js';

describe('chunkPackAudioGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(Buffer.from('combined-audio'));
    mockGenerateSilence.mockResolvedValue(Buffer.from('silence-audio'));
    mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio-data')]);
    mockUploadToGCS.mockImplementation(async ({ filename }) => `https://storage.example.com/${filename}`);
    mockFfprobe.mockImplementation((filePath, callback) => {
      callback(null, { format: { duration: 2 } }); // 2 seconds
    });
  });

  describe('generateExampleAudio', () => {
    const mockExamples: ChunkExampleData[] = [
      { chunkForm: '〜ておきます', sentence: '宿題（しゅくだい）をしておきます', english: 'I will do my homework in advance' },
      { chunkForm: '〜てしまう', sentence: '食べてしまいました', english: 'I ate it all' },
    ];

    it('should return empty map for empty examples', async () => {
      const result = await generateExampleAudio('pack-123', []);

      expect(result.size).toBe(0);
      expect(mockSynthesizeBatchedTexts).not.toHaveBeenCalled();
    });

    it('should generate audio at all three speeds', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([
        Buffer.from('audio-1'),
        Buffer.from('audio-2'),
      ]);

      await generateExampleAudio('pack-123', mockExamples);

      // Should be called 3 times per voice group (once per speed)
      // With 2 examples cycling through 2 different voices, that's:
      // voice-B (example 0): 3 calls
      // voice-C (example 1): 3 calls
      // Total: 6 calls
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(6);

      // Check each speed
      const calls = mockSynthesizeBatchedTexts.mock.calls;
      const speeds = calls.map((call: unknown[]) => (call[1] as { speed: number }).speed);
      expect(speeds).toContain(0.7);
      expect(speeds).toContain(0.85);
      expect(speeds).toContain(1.0);
    });

    it('should remove furigana from text before TTS', async () => {
      const examplesWithFurigana: ChunkExampleData[] = [
        { chunkForm: 'test', sentence: '会議（かいぎ）に出る', english: 'Attend meeting' },
      ];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExampleAudio('pack-123', examplesWithFurigana);

      // Verify furigana was removed
      const call = mockSynthesizeBatchedTexts.mock.calls[0];
      const texts = call[0] as string[];
      expect(texts[0]).toBe('会議に出る'); // Furigana removed
    });

    it('should group examples by voice for batched TTS', async () => {
      const threeExamples: ChunkExampleData[] = [
        { chunkForm: 'test1', sentence: 'Sentence 1', english: 'English 1' },
        { chunkForm: 'test2', sentence: 'Sentence 2', english: 'English 2' },
        { chunkForm: 'test3', sentence: 'Sentence 3', english: 'English 3' },
      ];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExampleAudio('pack-123', threeExamples);

      // Examples cycle through 3 voices, so each voice gets 1 example
      // Then called 3 times for 3 speeds = 9 calls total
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(9);
    });

    it('should upload each audio to GCS with correct path', async () => {
      const singleExample: ChunkExampleData[] = [
        { chunkForm: 'test', sentence: 'Test', english: 'Test' },
      ];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExampleAudio('pack-123', singleExample);

      // Should upload 3 times (once per speed)
      expect(mockUploadToGCS).toHaveBeenCalledTimes(3);
      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'example-0-0.7x.mp3',
        folder: 'chunk-packs/pack-123',
      }));
      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'example-0-0.85x.mp3',
      }));
      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'example-0-1x.mp3',
      }));
    });

    it('should return map keyed by sentence with all speed URLs', async () => {
      const singleExample: ChunkExampleData[] = [
        { chunkForm: 'test', sentence: 'Test sentence', english: 'Test' },
      ];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateExampleAudio('pack-123', singleExample);

      expect(result.has('Test sentence')).toBe(true);
      const urls = result.get('Test sentence');
      expect(urls).toHaveProperty('audioUrl_0_7');
      expect(urls).toHaveProperty('audioUrl_0_85');
      expect(urls).toHaveProperty('audioUrl_1_0');
    });

    it('should handle TTS errors gracefully', async () => {
      mockSynthesizeBatchedTexts.mockRejectedValue(new Error('TTS failed'));

      // Should not throw but return empty/partial results
      const result = await generateExampleAudio('pack-123', mockExamples);

      expect(result.size).toBe(0);
    });
  });

  describe('generateStoryAudio', () => {
    const mockSegments: ChunkStorySegmentData[] = [
      { japaneseText: '田中：おはようございます', englishTranslation: 'Tanaka: Good morning' },
      { japaneseText: '山田：おはよう', englishTranslation: 'Yamada: Morning' },
      { japaneseText: '田中：今日は会議がありますね', englishTranslation: 'Tanaka: We have a meeting today' },
    ];

    it('should create temp directory', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, mockSegments);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('chunk-story-'),
        { recursive: true }
      );
    });

    it('should detect and assign voices to speakers', async () => {
      // 田中 has 2 segments, 山田 has 1 segment
      mockSynthesizeBatchedTexts
        .mockResolvedValueOnce([Buffer.from('audio-1'), Buffer.from('audio-3')]) // 田中's 2 segments
        .mockResolvedValueOnce([Buffer.from('audio-2')]); // 山田's 1 segment

      await generateStoryAudio('pack-123', 0, mockSegments);

      // Two speakers means two voice groups
      // Each voice group is batched into one TTS call
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(2);

      // First voice (田中) - 2 segments
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        expect.arrayContaining(['おはようございます']),
        expect.objectContaining({ voiceId: 'ja-JP-Neural2-B' })
      );

      // Second voice (山田) - 1 segment
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        ['おはよう'],
        expect.objectContaining({ voiceId: 'ja-JP-Neural2-C' })
      );
    });

    it('should generate silence between segments', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, mockSegments);

      expect(mockGenerateSilence).toHaveBeenCalledWith(0.6);
    });

    it('should upload individual segment audio', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, [mockSegments[0]]);

      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'story-0-segment-0.mp3',
        folder: 'chunk-packs/pack-123',
      }));
    });

    it('should concatenate and upload combined audio', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, [mockSegments[0]]);

      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'story-0-combined.mp3',
      }));
    });

    it('should return combined URL and segment timing data', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
      mockFfprobe.mockImplementation((filePath, callback) => {
        callback(null, { format: { duration: 1 } }); // 1 second per segment
      });

      const result = await generateStoryAudio('pack-123', 0, [mockSegments[0]]);

      expect(result).toHaveProperty('combinedAudioUrl');
      expect(result).toHaveProperty('segmentAudioData');
      expect(result.segmentAudioData).toHaveLength(1);
      expect(result.segmentAudioData[0]).toHaveProperty('audioUrl');
      expect(result.segmentAudioData[0]).toHaveProperty('startTime', 0);
      expect(result.segmentAudioData[0]).toHaveProperty('endTime');
    });

    it('should calculate correct timing for multiple segments', async () => {
      // Two segments
      const twoSegments = mockSegments.slice(0, 2);
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
      mockFfprobe.mockImplementation((filePath, callback) => {
        // Each segment is 1 second
        callback(null, { format: { duration: 1 } });
      });

      const result = await generateStoryAudio('pack-123', 0, twoSegments);

      expect(result.segmentAudioData[0].startTime).toBe(0);
      expect(result.segmentAudioData[0].endTime).toBe(1000); // 1 second in ms
      // Second segment starts after first + silence (600ms)
      expect(result.segmentAudioData[1].startTime).toBe(2000); // After 1s segment + 1s silence
    });

    it('should cleanup temp directory on success', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, [mockSegments[0]]);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('chunk-story-'),
        { recursive: true, force: true }
      );
    });

    it('should cleanup temp directory on error', async () => {
      mockSynthesizeBatchedTexts.mockRejectedValue(new Error('TTS failed'));

      await expect(
        generateStoryAudio('pack-123', 0, mockSegments)
      ).rejects.toThrow('TTS failed');

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('chunk-story-'),
        { recursive: true, force: true }
      );
    });

    it('should use 0.85x speed for learners', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateStoryAudio('pack-123', 0, [mockSegments[0]]);

      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ speed: 0.85 })
      );
    });

    it('should handle segments without speaker prefix', async () => {
      const narrativeSegments: ChunkStorySegmentData[] = [
        { japaneseText: '彼は歩いた', englishTranslation: 'He walked' },
      ];
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateStoryAudio('pack-123', 0, narrativeSegments);

      expect(result.combinedAudioUrl).toBeDefined();
      // Should use default voice
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        ['彼は歩いた'],
        expect.objectContaining({ voiceId: 'ja-JP-Neural2-B' }) // First voice is default
      );
    });
  });

  describe('generateExerciseAudio', () => {
    const mockExercises: ChunkExerciseData[] = [
      {
        exerciseType: 'gap_fill_mc',
        prompt: '宿題を___おきます',
        options: ['して', 'する', 'した'],
        correctOption: 'して',
        explanation: 'Use て-form before おきます',
      },
      {
        exerciseType: 'gap_fill_mc',
        prompt: '食べ___しまいました',
        options: ['て', 'た', 'る'],
        correctOption: 'て',
        explanation: 'Use て-form',
      },
      {
        exerciseType: 'chunk_to_meaning',
        prompt: '〜ておきます',
        options: ['In advance', 'Instead'],
        correctOption: 'In advance',
        explanation: 'Means doing in advance',
      },
    ];

    it('should return empty map if no gap_fill exercises', async () => {
      const nonGapFill: ChunkExerciseData[] = [
        {
          exerciseType: 'chunk_to_meaning',
          prompt: 'test',
          options: ['a', 'b'],
          correctOption: 'a',
          explanation: 'test',
        },
      ];

      const result = await generateExerciseAudio('pack-123', nonGapFill);

      expect(result.size).toBe(0);
      expect(mockSynthesizeBatchedTexts).not.toHaveBeenCalled();
    });

    it('should only generate audio for gap_fill_mc exercises', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([
        Buffer.from('audio-1'),
        Buffer.from('audio-2'),
      ]);

      await generateExerciseAudio('pack-123', mockExercises);

      // Only 2 gap_fill_mc exercises
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(1);
      const texts = mockSynthesizeBatchedTexts.mock.calls[0][0] as string[];
      expect(texts).toHaveLength(2);
    });

    it('should replace ___ with correct option', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExerciseAudio('pack-123', [mockExercises[0]]);

      const texts = mockSynthesizeBatchedTexts.mock.calls[0][0] as string[];
      expect(texts[0]).toBe('宿題をしておきます'); // ___ replaced with して
    });

    it('should use single batched TTS call', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([
        Buffer.from('audio-1'),
        Buffer.from('audio-2'),
      ]);

      await generateExerciseAudio('pack-123', mockExercises);

      // Should be just 1 call with all texts
      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(1);
    });

    it('should use 0.85x speed for learners', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExerciseAudio('pack-123', [mockExercises[0]]);

      expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ speed: 0.85 })
      );
    });

    it('should upload to correct GCS path', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      await generateExerciseAudio('pack-123', [mockExercises[0]]);

      expect(mockUploadToGCS).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'exercise-0.mp3',
        folder: 'chunk-packs/pack-123',
      }));
    });

    it('should return map keyed by prompt', async () => {
      mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

      const result = await generateExerciseAudio('pack-123', [mockExercises[0]]);

      expect(result.has('宿題を___おきます')).toBe(true);
      expect(result.get('宿題を___おきます')).toContain('exercise-0');
    });

    it('should throw on TTS error', async () => {
      mockSynthesizeBatchedTexts.mockRejectedValue(new Error('TTS failed'));

      await expect(
        generateExerciseAudio('pack-123', [mockExercises[0]])
      ).rejects.toThrow('TTS failed');
    });
  });
});
