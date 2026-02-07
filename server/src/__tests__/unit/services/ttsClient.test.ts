import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createSSMLWithPauses,
  createSSMLSlow,
  createLessonSSML,
  createAnticipationPromptSSML,
  synthesizeSpeech,
  generateSilence,
} from '../../../services/ttsClient.js';

// Mock TTS Provider
const mockProvider = vi.hoisted(() => ({
  getName: vi.fn(() => 'GoogleTTS'),
  synthesizeSpeech: vi.fn(),
}));

vi.mock('../../../services/ttsProviders/TTSProvider.js', () => ({
  getTTSProvider: vi.fn(async () => mockProvider),
}));

describe('SSML Helper Functions', () => {
  describe('createSSMLWithPauses', () => {
    it('should wrap text with SSML speak tags and default 1s pause', () => {
      const result = createSSMLWithPauses('Hello world');
      expect(result).toBe('<speak>Hello world<break time="1s"/></speak>');
    });

    it('should use custom pause duration', () => {
      const result = createSSMLWithPauses('Hello world', '2s');
      expect(result).toBe('<speak>Hello world<break time="2s"/></speak>');
    });

    it('should handle empty text', () => {
      const result = createSSMLWithPauses('');
      expect(result).toBe('<speak><break time="1s"/></speak>');
    });
  });

  describe('createSSMLSlow', () => {
    it('should wrap text with prosody tag at default 0.75 rate', () => {
      const result = createSSMLSlow('Hello world');
      expect(result).toBe('<speak><prosody rate="0.75">Hello world</prosody></speak>');
    });

    it('should use custom rate', () => {
      const result = createSSMLSlow('Hello world', 0.5);
      expect(result).toBe('<speak><prosody rate="0.5">Hello world</prosody></speak>');
    });
  });

  describe('createLessonSSML', () => {
    it('should wrap text with SSML and default 0.5s pause', () => {
      const result = createLessonSSML('Listen and repeat');
      expect(result).toBe('<speak>Listen and repeat<break time="0.5s"/></speak>');
    });

    it('should use custom pause duration', () => {
      const result = createLessonSSML('Listen and repeat', 1);
      expect(result).toBe('<speak>Listen and repeat<break time="1s"/></speak>');
    });
  });

  describe('createAnticipationPromptSSML', () => {
    it('should create SSML with 3 second pause for learner response', () => {
      const result = createAnticipationPromptSSML('How do you say hello?');
      expect(result).toBe('<speak>How do you say hello?<break time="3s"/></speak>');
    });
  });
});

describe('synthesizeSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should synthesize speech with default parameters', async () => {
    const mockAudioBuffer = Buffer.from('audio data');
    mockProvider.synthesizeSpeech.mockResolvedValue(mockAudioBuffer);

    const result = await synthesizeSpeech({
      text: 'Hello world',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
    });

    expect(mockProvider.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'Hello world',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
      speed: 1.0,
      pitch: 0,
      ssml: false,
    });
    expect(result).toBe(mockAudioBuffer);
  });

  it('should synthesize speech with custom speed and pitch', async () => {
    const mockAudioBuffer = Buffer.from('audio data');
    mockProvider.synthesizeSpeech.mockResolvedValue(mockAudioBuffer);

    const result = await synthesizeSpeech({
      text: 'Hello world',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
      speed: 0.8,
      pitch: 2,
    });

    expect(mockProvider.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'Hello world',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
      speed: 0.8,
      pitch: 2,
      ssml: false,
    });
    expect(result).toBe(mockAudioBuffer);
  });

  it('should synthesize speech with SSML enabled', async () => {
    const mockAudioBuffer = Buffer.from('audio data');
    mockProvider.synthesizeSpeech.mockResolvedValue(mockAudioBuffer);

    const result = await synthesizeSpeech({
      text: '<speak>Hello world</speak>',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
      useSSML: true,
    });

    expect(mockProvider.synthesizeSpeech).toHaveBeenCalledWith({
      text: '<speak>Hello world</speak>',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
      speed: 1.0,
      pitch: 0,
      ssml: true,
    });
    expect(result).toBe(mockAudioBuffer);
  });

  it('should throw error when audio buffer is empty', async () => {
    mockProvider.synthesizeSpeech.mockResolvedValue(Buffer.from(''));

    await expect(
      synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-D',
        languageCode: 'en-US',
      })
    ).rejects.toThrow('TTS returned empty audio buffer');
  });

  it('should throw error when audio buffer is null', async () => {
    mockProvider.synthesizeSpeech.mockResolvedValue(null as unknown as Buffer);

    await expect(
      synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-D',
        languageCode: 'en-US',
      })
    ).rejects.toThrow('TTS returned empty audio buffer');
  });

  it('should handle provider errors with Error instance', async () => {
    mockProvider.synthesizeSpeech.mockRejectedValue(new Error('Provider error'));

    await expect(
      synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-D',
        languageCode: 'en-US',
      })
    ).rejects.toThrow('Failed to synthesize speech: Provider error');
  });

  it('should handle provider errors with non-Error object', async () => {
    mockProvider.synthesizeSpeech.mockRejectedValue('String error');

    await expect(
      synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-D',
        languageCode: 'en-US',
      })
    ).rejects.toThrow('Failed to synthesize speech: Unknown TTS error');
  });

  it('should log provider name and voice', async () => {
    const mockAudioBuffer = Buffer.from('audio data');
    mockProvider.synthesizeSpeech.mockResolvedValue(mockAudioBuffer);

    await synthesizeSpeech({
      text: 'Hello world',
      voiceId: 'en-US-Neural2-D',
      languageCode: 'en-US',
    });

    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[TTS] Using provider: GoogleTTS for voice: en-US-Neural2-D')
    );
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[TTS] Generated'));
  });
});

describe('generateSilence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should generate silence using ffmpeg and return a buffer', async () => {
    const result = await generateSilence(1);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should generate different lengths of silence', async () => {
    const short = await generateSilence(0.5);
    const long = await generateSilence(2);
    // Longer silence should produce a larger file
    expect(long.length).toBeGreaterThan(short.length);
  });
});
