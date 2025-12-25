import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { GoogleTTSProvider } from '../../../../services/ttsProviders/GoogleTTSProvider.js';

// Create hoisted mocks
const mockSynthesizeSpeech = vi.hoisted(() => vi.fn());

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: class {
    synthesizeSpeech = mockSynthesizeSpeech;
  },
  protos: {
    google: {
      cloud: {
        texttospeech: {
          v1: {},
        },
      },
    },
  },
}));

describe('GoogleTTSProvider', () => {
  let provider: GoogleTTSProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleTTSProvider();
  });

  describe('getName', () => {
    it('should return the provider name', () => {
      expect(provider.getName()).toBe('Google Cloud TTS');
    });
  });

  describe('synthesizeSpeech', () => {
    it('should synthesize speech with default options', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      const result = await provider.synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-A',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('audio data');
      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text: 'Hello world' },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-A',
          },
          audioConfig: expect.objectContaining({
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0,
          }),
        })
      );
    });

    it('should use SSML input when ssml option is true', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: '<speak>Hello world</speak>',
        voiceId: 'en-US-Neural2-A',
        ssml: true,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { ssml: '<speak>Hello world</speak>' },
        })
      );
    });

    it('should apply custom speed', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-A',
        speed: 0.8,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            speakingRate: 0.8,
          }),
        })
      );
    });

    it('should convert pitch from Hz to semitones', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hello world',
        voiceId: 'en-US-Neural2-A',
        pitch: 6, // 6 Hz should be 2 semitones
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            pitch: 2, // 6 / 3.0 = 2
          }),
        })
      );
    });

    it('should extract language code from voice ID', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'こんにちは',
        voiceId: 'ja-JP-Neural2-B',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'ja-JP',
          }),
        })
      );
    });

    it('should use provided languageCode over extracted one', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hello',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-GB',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'en-GB',
          }),
        })
      );
    });

    it('should default to en-US for unrecognized voice ID patterns', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hello',
        voiceId: 'custom-voice',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'en-US',
          }),
        })
      );
    });

    it('should throw error when no audio content is returned', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: null }]);

      await expect(
        provider.synthesizeSpeech({
          text: 'Hello',
          voiceId: 'en-US-Neural2-A',
        })
      ).rejects.toThrow('No audio content received from Google Cloud TTS');
    });

    it('should wrap API errors with descriptive message', async () => {
      mockSynthesizeSpeech.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        provider.synthesizeSpeech({
          text: 'Hello',
          voiceId: 'en-US-Neural2-A',
        })
      ).rejects.toThrow(
        'Failed to synthesize speech with Google Cloud TTS: API rate limit exceeded'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockSynthesizeSpeech.mockRejectedValue('Unknown error string');

      await expect(
        provider.synthesizeSpeech({
          text: 'Hello',
          voiceId: 'en-US-Neural2-A',
        })
      ).rejects.toThrow('Failed to synthesize speech with Google Cloud TTS: Unknown error');
    });

    it('should include headphone-class-device effect profile', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hello',
        voiceId: 'en-US-Neural2-A',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            effectsProfileId: ['headphone-class-device'],
          }),
        })
      );
    });
  });

  describe('extractLanguageCode (via synthesizeSpeech)', () => {
    it('should extract es-ES language code', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: 'Hola',
        voiceId: 'es-ES-Neural2-A',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'es-ES',
          }),
        })
      );
    });

    it('should extract zh-CN language code', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent }]);

      await provider.synthesizeSpeech({
        text: '你好',
        voiceId: 'zh-CN-Wavenet-A',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({
            languageCode: 'zh-CN',
          }),
        })
      );
    });
  });
});
