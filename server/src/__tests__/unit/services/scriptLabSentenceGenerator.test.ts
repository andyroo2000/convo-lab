import { describe, it, expect, vi, beforeEach } from 'vitest';

import { generateSentenceScript } from '../../../services/scriptLabSentenceGenerator.js';

// Hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());
const mockProcessJapaneseBatch = vi.hoisted(() => vi.fn());
const mockApplyOverrides = vi.hoisted(() => vi.fn());

vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

vi.mock('../../../services/languageProcessor.js', () => ({
  processJapaneseBatch: mockProcessJapaneseBatch,
}));

vi.mock('../../../services/pronunciation/overrideEngine.js', () => ({
  applyJapanesePronunciationOverrides: mockApplyOverrides,
}));

describe('scriptLabSentenceGenerator', () => {
  const baseOptions = {
    sentence: '東京に行きました',
    translation: 'I went to Tokyo',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    jlptLevel: 'N4',
    l1VoiceId: 'en-voice-id',
    l2VoiceId: 'ja-voice-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessJapaneseBatch.mockResolvedValue([]);
    mockApplyOverrides.mockReturnValue('');
  });

  describe('generateSentenceScript', () => {
    it('should parse valid JSON response into normalized units with correct types/voiceIds', async () => {
      const geminiResponse = JSON.stringify({
        translation: 'I went to Tokyo',
        units: [
          { type: 'narration_L1', text: "Here's how you say went" },
          { type: 'pause', seconds: 1.0 },
          { type: 'L2', text: '行きました', reading: 'いきました', speed: 0.8 },
          { type: 'marker', label: 'Build' },
        ],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      const result = await generateSentenceScript(baseOptions);

      expect(result.units).not.toBeNull();
      expect(result.units).toHaveLength(4);

      const narration = result.units![0];
      expect(narration.type).toBe('narration_L1');
      expect(narration).toHaveProperty('voiceId', 'en-voice-id');

      const pause = result.units![1];
      expect(pause.type).toBe('pause');
      expect(pause).toHaveProperty('seconds', 1.0);

      const l2 = result.units![2];
      expect(l2.type).toBe('L2');
      expect(l2).toHaveProperty('voiceId', 'ja-voice-id');
      expect(l2).toHaveProperty('reading', 'いきました');
      expect(l2).toHaveProperty('speed', 0.8);

      const marker = result.units![3];
      expect(marker.type).toBe('marker');
      expect(marker).toHaveProperty('label', 'Build');
    });

    it('should return resolvedPrompt with placeholders filled in', async () => {
      mockGenerateWithGemini.mockResolvedValue('{"units":[]}');

      const result = await generateSentenceScript(baseOptions);

      expect(result.resolvedPrompt).toContain('東京に行きました');
      expect(result.resolvedPrompt).toContain('I went to Tokyo');
      expect(result.resolvedPrompt).toContain('ja');
      expect(result.resolvedPrompt).toContain('en');
    });

    it('should return parseError when Gemini returns invalid JSON', async () => {
      mockGenerateWithGemini.mockResolvedValue('This is not JSON at all');

      const result = await generateSentenceScript(baseOptions);

      expect(result.parseError).toBeDefined();
      expect(result.units).toBeNull();
      expect(result.estimatedDurationSeconds).toBeNull();
      expect(result.rawResponse).toBe('This is not JSON at all');
    });

    it('should strip markdown code fences from response before parsing', async () => {
      const jsonContent = JSON.stringify({
        units: [{ type: 'narration_L1', text: 'Hello' }],
      });
      mockGenerateWithGemini.mockResolvedValue('```json\n' + jsonContent + '\n```');

      const result = await generateSentenceScript(baseOptions);

      expect(result.parseError).toBeUndefined();
      expect(result.units).toHaveLength(1);
      expect(result.units![0].type).toBe('narration_L1');
    });

    it('should hydrate Japanese readings for L2 units missing them', async () => {
      const geminiResponse = JSON.stringify({
        units: [
          { type: 'L2', text: '東京に行きました' },
          { type: 'L2', text: '行きました', reading: 'いきました' },
        ],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      mockProcessJapaneseBatch.mockResolvedValue([
        { kana: 'とうきょうにいきました', furigana: '東京[とうきょう]に行[い]きました' },
      ]);
      mockApplyOverrides.mockReturnValue('とうきょうにいきました');

      const result = await generateSentenceScript(baseOptions);

      // Only the first unit (no reading) should trigger hydration
      expect(mockProcessJapaneseBatch).toHaveBeenCalledWith(['東京に行きました']);
      expect(result.units![0]).toHaveProperty('reading', 'とうきょうにいきました');
      // The second unit already had a reading, so it should be unchanged
      expect(result.units![1]).toHaveProperty('reading', 'いきました');
    });

    it('should use default prompt when no override provided', async () => {
      mockGenerateWithGemini.mockResolvedValue('{"units":[]}');

      const result = await generateSentenceScript(baseOptions);

      // The default SENTENCE_SCRIPT_PROMPT contains "Pimsleur Method"
      expect(result.resolvedPrompt).toContain('Pimsleur Method');
    });

    it('should use prompt override when provided', async () => {
      mockGenerateWithGemini.mockResolvedValue('{"units":[]}');

      const result = await generateSentenceScript({
        ...baseOptions,
        promptOverride: 'Custom prompt for {{sentence}} in {{targetLanguage}}',
      });

      expect(result.resolvedPrompt).toBe('Custom prompt for 東京に行きました in ja');
      expect(result.resolvedPrompt).not.toContain('Pimsleur Method');
    });

    it('should estimate duration from parsed units', async () => {
      const geminiResponse = JSON.stringify({
        units: [
          { type: 'narration_L1', text: 'Now say the full sentence' },
          { type: 'pause', seconds: 2.0 },
          { type: 'L2', text: '東京に行きました', speed: 1.0 },
        ],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      const result = await generateSentenceScript(baseOptions);

      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
      expect(typeof result.estimatedDurationSeconds).toBe('number');
    });

    it('should handle response as bare array (no wrapper object)', async () => {
      const geminiResponse = JSON.stringify([
        { type: 'narration_L1', text: 'Listen and repeat' },
        { type: 'L2', text: '東京', reading: 'とうきょう' },
      ]);
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      const result = await generateSentenceScript(baseOptions);

      expect(result.parseError).toBeUndefined();
      expect(result.units).toHaveLength(2);
      expect(result.units![0].type).toBe('narration_L1');
      expect(result.units![1].type).toBe('L2');
    });

    it('should extract translation from Gemini response when not provided in input', async () => {
      const geminiResponse = JSON.stringify({
        translation: 'I went to Tokyo',
        units: [{ type: 'narration_L1', text: 'Listen' }],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      const result = await generateSentenceScript({
        ...baseOptions,
        translation: undefined,
      });

      expect(result.translation).toBe('I went to Tokyo');
    });

    it('should skip units with unknown types', async () => {
      const geminiResponse = JSON.stringify({
        units: [
          { type: 'narration_L1', text: 'Valid unit' },
          { type: 'sfx', text: 'ding.mp3' },
          { type: 'L2', text: '東京' },
        ],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      const result = await generateSentenceScript(baseOptions);

      expect(result.units).toHaveLength(2);
      expect(result.units![0].type).toBe('narration_L1');
      expect(result.units![1].type).toBe('L2');
    });

    it('should not hydrate readings for non-Japanese target language', async () => {
      const geminiResponse = JSON.stringify({
        units: [{ type: 'L2', text: 'Bonjour' }],
      });
      mockGenerateWithGemini.mockResolvedValue(geminiResponse);

      await generateSentenceScript({
        ...baseOptions,
        targetLanguage: 'fr',
      });

      expect(mockProcessJapaneseBatch).not.toHaveBeenCalled();
    });
  });
});
