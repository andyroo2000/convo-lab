import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  groupUnitsIntoBatches,
  buildBatchSSML,
  processBatches,
  hasFishAudioControlTokens,
  FISH_AUDIO_TRAILING_BREAK,
} from '../../../services/batchedTTSClient.js';
import { LessonScriptUnit } from '../../../services/lessonScriptGenerator.js';

// Create hoisted mocks
const mockGetGoogleTTSBetaProvider = vi.hoisted(() => vi.fn());
const mockGetPollyTTSProvider = vi.hoisted(() => vi.fn());
const mockGenerateSilence = vi.hoisted(() => vi.fn());
const mockSynthesizeFishAudioSpeech = vi.hoisted(() => vi.fn());
const mockResolveFishAudioVoiceId = vi.hoisted(() => vi.fn());
const mockIsFishAudioAvailable = vi.hoisted(() => vi.fn());
const mockFfmpeg = vi.hoisted(() => {
  const mockInstance = {
    setStartTime: vi.fn().mockReturnThis(),
    setDuration: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function (
      this: typeof mockInstance,
      event: string,
      callback: () => void
    ) {
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return this;
    }),
    run: vi.fn(),
  };
  const ffmpegFn = vi.fn(() => mockInstance);
  (ffmpegFn as typeof ffmpegFn & { ffprobe: typeof vi.fn }).ffprobe = vi.fn(
    (path: string, cb: (err: Error | null, metadata: { format: { duration: number } }) => void) => {
      cb(null, { format: { duration: 10.0 } });
    }
  );
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

vi.mock('../../../services/ttsProviders/FishAudioTTSProvider.js', () => ({
  synthesizeFishAudioSpeech: mockSynthesizeFishAudioSpeech,
  resolveFishAudioVoiceId: mockResolveFishAudioVoiceId,
  isFishAudioAvailable: mockIsFishAudioAvailable,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg.ffmpegFn,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() =>
    JSON.stringify({ keepKanji: ['橋'], forceKana: { 北海道: 'ほっかいどう' } })
  ),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: mockFs,
}));

describe('batchedTTSClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveFishAudioVoiceId.mockReturnValue('fishaudio-voice');
    mockSynthesizeFishAudioSpeech.mockResolvedValue(Buffer.from('audio data'));
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

    it('should handle pause units and track them separately without breaking batches', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'Before', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'pause', seconds: 2 },
        { type: 'L2', text: 'After', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches, pauseIndices } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches).toHaveLength(1); // Pauses don't break batches (they're generated separately)
      expect(batches[0].units).toHaveLength(2); // Both 'Before' and 'After' in same batch
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

    it('should use Japanese reading for TTS when available', () => {
      const units: LessonScriptUnit[] = [
        {
          type: 'L2',
          text: '漢字',
          reading: '漢字[かんじ]',
          voiceId: 'ja-JP-Neural2-B',
          speed: 1.0,
        },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      // Use furigana reading for Japanese TTS
      expect(batches[0].units[0].text).toBe('かんじ');
    });

    it('should keep kanji for keep-kanji words', () => {
      const units: LessonScriptUnit[] = [
        {
          type: 'L2',
          text: '橋',
          reading: 'はし',
          voiceId: 'ja-JP-Neural2-B',
          speed: 1.0,
        },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].units[0].text).toBe('橋');
    });

    it('should force kana for force-kana words', () => {
      const units: LessonScriptUnit[] = [
        {
          type: 'L2',
          text: '北海道',
          voiceId: 'ja-JP-Neural2-B',
          speed: 1.0,
        },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].units[0].text).toBe('ほっかいどう');
    });

    it('should keep kanji inside bracket notation when specified', () => {
      const units: LessonScriptUnit[] = [
        {
          type: 'L2',
          text: '橋を渡る',
          reading: '橋[はし]を渡[わた]る',
          voiceId: 'ja-JP-Neural2-B',
          speed: 1.0,
        },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      expect(batches[0].units[0].text).toBe('橋をわたる');
    });

    it('should keep text field for non-Japanese target language', () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: '漢字', reading: 'かんじ', voiceId: 'en-US-Neural2-A', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'en-US');

      expect(batches[0].units[0].text).toBe('漢字');
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

      expect(batches).toHaveLength(1); // Both units in same batch (pauses don't break batches)
      expect(batches[0].units[0].originalIndex).toBe(1); // After marker
      expect(batches[0].units[0].markName).toBe('unit_1');
      expect(batches[0].units[1].originalIndex).toBe(3); // After pause, but same batch
      expect(batches[0].units[1].markName).toBe('unit_3');
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

      expect(ssml).toBe(
        '<speak><mark name="unit_0"/>Hello<break time="300ms"/><mark name="unit_1"/>World<break time="300ms"/></speak>'
      );
    });

    it('should wrap content in prosody tag for Polly provider', () => {
      const batch = createBatch({ speed: 0.7 });

      const ssml = buildBatchSSML(batch, 'polly');

      expect(ssml).toBe(
        '<speak><prosody rate="70%"><mark name="unit_0"/>Hello<break time="300ms"/><mark name="unit_1"/>World<break time="300ms"/></prosody></speak>'
      );
    });

    it('should escape special characters in text', () => {
      const batch = createBatch({
        units: [{ originalIndex: 0, markName: 'unit_0', text: '<hello> & "world"' }],
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

  describe('hasFishAudioControlTokens', () => {
    it('should detect control tokens anywhere in the text', () => {
      expect(hasFishAudioControlTokens('Hello (break) world')).toBe(true);
      expect(hasFishAudioControlTokens('(long-break)')).toBe(true);
      expect(hasFishAudioControlTokens('Testing (laugh) now')).toBe(true);
      expect(hasFishAudioControlTokens('breath (breath) test')).toBe(true);
    });

    it('should ignore non-control parentheses', () => {
      expect(hasFishAudioControlTokens('Hello (not-a-token) world')).toBe(false);
      expect(hasFishAudioControlTokens('Just text')).toBe(false);
    });
  });

  describe('Fish Audio integration', () => {
    it('should append trailing break for the final Fish Audio unit', async () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: 'こんにちは', voiceId: 'fishaudio:voice-1', speed: 1.0 },
        { type: 'L2', text: 'さようなら', voiceId: 'fishaudio:voice-1', speed: 1.0 },
      ];

      await processBatches(units, {
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        tempDir: '/tmp/fish-audio',
      });

      expect(mockSynthesizeFishAudioSpeech).toHaveBeenCalledTimes(2);
      const firstCallText = mockSynthesizeFishAudioSpeech.mock.calls[0][0].text;
      const secondCallText = mockSynthesizeFishAudioSpeech.mock.calls[1][0].text;

      expect(firstCallText).not.toContain(FISH_AUDIO_TRAILING_BREAK);
      expect(secondCallText).toContain(FISH_AUDIO_TRAILING_BREAK);
    });

    it('should apply pronunciation overrides during Fish Audio batch synthesis', async () => {
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: '北海道', voiceId: 'fishaudio:voice-1', speed: 1.0 },
      ];

      await processBatches(units, {
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        tempDir: '/tmp/fish-audio-overrides',
      });

      expect(mockSynthesizeFishAudioSpeech).toHaveBeenCalledTimes(1);
      const callText = mockSynthesizeFishAudioSpeech.mock.calls[0][0].text;
      expect(callText).toContain('ほっかいどう');
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

    it('should group alternating voices into minimal batches', () => {
      // Simulate a lesson script that alternates between narrator and L2 speaker
      const units: LessonScriptUnit[] = [
        { type: 'narration_L1', text: 'Hello', voiceId: 'en-US-Neural2-J' },
        { type: 'L2', text: 'こんにちは', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'pause', seconds: 1 },
        { type: 'narration_L1', text: 'How are you?', voiceId: 'en-US-Neural2-J' },
        { type: 'L2', text: 'お元気ですか？', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
        { type: 'pause', seconds: 1 },
        { type: 'narration_L1', text: 'Goodbye', voiceId: 'en-US-Neural2-J' },
        { type: 'L2', text: 'さようなら', voiceId: 'ja-JP-Neural2-B', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      // Should create only 2 batches (all English together, all Japanese together)
      // Instead of 6 batches if processing sequentially
      expect(batches).toHaveLength(2);

      // Find English and Japanese batches
      const englishBatch = batches.find((b) => b.voiceId === 'en-US-Neural2-J');
      const japaneseBatch = batches.find((b) => b.voiceId === 'ja-JP-Neural2-B');

      expect(englishBatch).toBeDefined();
      expect(japaneseBatch).toBeDefined();
      expect(englishBatch!.units).toHaveLength(3); // 3 English narrations
      expect(japaneseBatch!.units).toHaveLength(3); // 3 Japanese phrases

      // Verify original indices are preserved for correct reassembly
      expect(englishBatch!.units[0].originalIndex).toBe(0);
      expect(englishBatch!.units[1].originalIndex).toBe(3);
      expect(englishBatch!.units[2].originalIndex).toBe(6);
      expect(japaneseBatch!.units[0].originalIndex).toBe(1);
      expect(japaneseBatch!.units[1].originalIndex).toBe(4);
      expect(japaneseBatch!.units[2].originalIndex).toBe(7);
    });

    it('should split large batches that exceed byte limit', () => {
      // Create a batch with very long text that will exceed 4800 byte limit
      const longText = 'A'.repeat(2000); // 2000 bytes each
      const units: LessonScriptUnit[] = [
        { type: 'L2', text: longText, voiceId: 'test-voice', speed: 1.0 },
        { type: 'L2', text: longText, voiceId: 'test-voice', speed: 1.0 },
        { type: 'L2', text: longText, voiceId: 'test-voice', speed: 1.0 },
        { type: 'L2', text: longText, voiceId: 'test-voice', speed: 1.0 },
      ];

      const { batches } = groupUnitsIntoBatches(units, 'en-US', 'ja-JP');

      // Should split into multiple batches to stay under limit
      // With 2000 bytes each + markup, should fit 2 units per batch
      expect(batches.length).toBeGreaterThan(1);

      // Verify each batch has correct voice properties
      for (const batch of batches) {
        expect(batch.voiceId).toBe('test-voice');
        expect(batch.speed).toBe(1.0);
      }

      // Verify all units are present and in correct order
      const allUnits = batches.flatMap((b) => b.units);
      expect(allUnits).toHaveLength(4);
      expect(allUnits[0].originalIndex).toBe(0);
      expect(allUnits[1].originalIndex).toBe(1);
      expect(allUnits[2].originalIndex).toBe(2);
      expect(allUnits[3].originalIndex).toBe(3);
    });
  });
});
