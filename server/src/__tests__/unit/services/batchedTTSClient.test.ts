import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { groupUnitsIntoBatches, buildBatchSSML } from '../../../services/batchedTTSClient.js';
import { LessonScriptUnit } from '../../../services/lessonScriptGenerator.js';

// Create hoisted mocks
const mockGetGoogleTTSBetaProvider = vi.hoisted(() => vi.fn());
const mockGetPollyTTSProvider = vi.hoisted(() => vi.fn());
const mockGenerateSilence = vi.hoisted(() => vi.fn());
const mockFfmpeg = vi.hoisted(() => {
  const mockInstance = {
    setStartTime: vi.fn().mockReturnThis(),
    setDuration: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function (this: any, event: string, callback: any) {
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return this;
    }),
    run: vi.fn(),
  };
  const ffmpegFn = vi.fn(() => mockInstance);
  (ffmpegFn as any).ffprobe = vi.fn((path, cb) => {
    cb(null, { format: { duration: 10.0 } });
  });
  return { ffmpegFn, mockInstance };
});
const mockFs = vi.hoisted(() => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('audio data')),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock TTS providers
vi.mock('../../../services/ttsProviders/GoogleTTSBetaProvider.js', () => ({
  getGoogleTTSBetaProvider: mockGetGoogleTTSBetaProvider,
}));

vi.mock('../../../services/ttsProviders/PollyTTSProvider.js', () => ({
  getPollyTTSProvider: mockGetPollyTTSProvider,
}));

vi.mock('../../../services/ttsClient.js', () => ({
  generateSilence: mockGenerateSilence,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg.ffmpegFn,
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

describe('batchedTTSClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('groupUnitsIntoBatches', () => {
    it('should group consecutive units with same voice and speed into one batch', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Hello', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'L2', text: 'World', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'L2', text: 'Test', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches, pauseIndices } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(1);
      expect(batches[0].voiceId).toBe('ja-JP-Neural2-B');
      expect(batches[0].units).toHaveLength(3);
      expect(pauseIndices.size).toBe(0);
    });

    it('should create new batch when voice changes', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Hello', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'L2', text: 'World', voiceId: 'ja-JP-Neural2-C', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(2);
      expect(batches[0].voiceId).toBe('ja-JP-Neural2-B');
      expect(batches[1].voiceId).toBe('ja-JP-Neural2-C');
    });

    it('should create new batch when speed changes', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Slow', voiceId: 'ja-JP-Neural2-B', speed: 0.7 },
        { type: 'L2', text: 'Fast', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(2);
      expect(batches[0].speed).toBe(0.7);
      expect(batches[1].speed).toBe(1.0);
    });

    it('should handle pause units and track them separately', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Before', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'pause', seconds: 2 },
        { type: 'L2', text: 'After', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches, pauseIndices } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(2); // Pause breaks the batch
      expect(pauseIndices.size).toBe(1);
      expect(pauseIndices.get(1)).toBe(2); // Index 1 has 2 second pause
    });

    it('should skip marker units entirely', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Hello', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'marker', name: 'section_start' },
        { type: 'L2', text: 'World', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(1); // Marker doesn't break batch
      expect(batches[0].units).toHaveLength(2);
    });

    it('should use reading instead of text for L2 units when available', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: '漢字', reading: 'かんじ', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].units[0].text).toBe('かんじ');
    });

    it('should use native language code for narration_L1 units', () => {
      const units: LessonScriptUnit[] = [
        { type: 'narration_L1', text: 'English narration', voiceId: 'en-US-Neural2-A', speed: 1.0 },
        { type: 'L2', text: 'Japanese text', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(2); // Different language codes
      expect(batches[0].languageCode).toBe('en-US');
      expect(batches[1].languageCode).toBe('ja-JP');
    });

    it('should handle empty units array', () => {
      const units: LessonScriptUnit[] = [];

      const { batches, pauseIndices } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(0);
      expect(pauseIndices.size).toBe(0);
    });

    it('should set default speed of 1.0 for non-L2 units', () => {
      const units: LessonScriptUnit[] = [
        { type: 'narration_L1', text: 'Narration', voiceId: 'en-US-Neural2-A' },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].speed).toBe(1.0);
    });

    it('should preserve original index in unit markers', () => {
      const units: LessonScriptUnit[] = [
        { type: 'marker', name: 'start' },
        { type: 'L2', text: 'Hello', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'pause', seconds: 1 },
        { type: 'L2', text: 'World', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].units[0].originalIndex).toBe(1); // After marker
      expect(batches[0].units[0].markName).toBe('unit_1');
      expect(batches[1].units[0].originalIndex).toBe(3); // After pause
      expect(batches[1].units[0].markName).toBe('unit_3');
    });
  });

  describe('buildBatchSSML', () => {
    const createBatch = (overrides = {}) => ({
      voiceId: 'ja-JP-Neural2-B',
      languageCode: 'ja-JP',
      speed: 1.0,
      pitch: 0,
      units: [
        { originalIndex: 0, markName: 'unit_0', text: 'Hello' },
        { originalIndex: 1, markName: 'unit_1', text: 'World' },
      ],
      ...overrides,
    });

    it('should build SSML with mark tags for Google provider', () => {
      const batch = createBatch();

      const ssml = buildBatchSSML(batch, 'google');

      expect(ssml).toBe('<speak><mark name="unit_0"/>Hello<mark name="unit_1"/>World</speak>');
    });

    it('should wrap content in prosody tag for Polly provider', () => {
      const batch = createBatch({ speed: 0.7 });

      const ssml = buildBatchSSML(batch, 'polly');

      expect(ssml).toBe('<speak><prosody rate="70%"><mark name="unit_0"/>Hello<mark name="unit_1"/>World</prosody></speak>');
    });

    it('should escape special characters in text', () => {
      const batch = createBatch({
        units: [
          { originalIndex: 0, markName: 'unit_0', text: '<hello> & "world"' },
        ],
      });

      const ssml = buildBatchSSML(batch, 'google');

      expect(ssml).toContain('&lt;hello&gt; &amp; &quot;world&quot;');
    });

    it('should handle empty units array', () => {
      const batch = createBatch({ units: [] });

      const ssml = buildBatchSSML(batch, 'google');

      expect(ssml).toBe('<speak></speak>');
    });

    it('should convert speed to percentage for Polly', () => {
      const batch = createBatch({ speed: 1.5 }); // 150%

      const ssml = buildBatchSSML(batch, 'polly');

      expect(ssml).toContain('rate="150%"');
    });

    it('should escape apostrophe in text', () => {
      const batch = createBatch({
        units: [{ originalIndex: 0, markName: 'unit_0', text: "it's fine" }],
      });

      const ssml = buildBatchSSML(batch, 'google');

      expect(ssml).toContain('it&apos;s fine');
    });
  });

  describe('provider detection', () => {
    // Test through groupUnitsIntoBatches behavior since getProviderFromVoiceId is internal
    it('should handle Google voice IDs (with hyphens)', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Test', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].voiceId).toBe('ja-JP-Neural2-B');
    });

    it('should handle Polly voice IDs (without hyphens)', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Test', voiceId: 'Takumi', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].voiceId).toBe('Takumi');
    });
  });

  describe('complex scenarios', () => {
    it('should handle a full lesson script with mixed unit types', () => {
      const units: LessonScriptUnit[] = [
        { type: 'marker', name: 'lesson_start' },
        { type: 'narration_L1', text: 'Welcome to the lesson', voiceId: 'en-US-Neural2-A' },
        { type: 'pause', seconds: 1 },
        { type: 'L2', text: 'こんにちは', voiceId: 'ja-JP-Neural2-B', speed: 0.7 },
        { type: 'L2', text: 'おはようございます', voiceId: 'ja-JP-Neural2-B', speed: 0.7 },
        { type: 'pause', seconds: 2 },
        { type: 'L2', text: 'さようなら', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'marker', name: 'lesson_end' },
      ];

      const { batches, pauseIndices } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      // Expected batches:
      // 1. narration_L1 (en-US)
      // 2. L2 slow (ja-JP, speed 0.7) with 2 units
      // 3. L2 normal (ja-JP, speed 1.0)
      expect(batches).toHaveLength(3);
      expect(batches[0].languageCode).toBe('en-US');
      expect(batches[1].speed).toBe(0.7);
      expect(batches[1].units).toHaveLength(2);
      expect(batches[2].speed).toBe(1.0);

      // 2 pauses at indices 2 and 5
      expect(pauseIndices.size).toBe(2);
      expect(pauseIndices.get(2)).toBe(1);
      expect(pauseIndices.get(5)).toBe(2);
    });

    it('should handle pitch variations', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Normal', voiceId: 'ja-JP-Neural2-B', speed: 1.0, pitch: 0 },
        { type: 'L2', text: 'High', voiceId: 'ja-JP-Neural2-B', speed: 1.0, pitch: 5 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      // Pitch doesn't create new batches in current implementation
      expect(batches).toHaveLength(1);
    });
  });
});
