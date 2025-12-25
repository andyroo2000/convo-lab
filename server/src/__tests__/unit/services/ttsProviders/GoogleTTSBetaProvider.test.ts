import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  GoogleTTSBetaProvider,
  getGoogleTTSBetaProvider,
} from '../../../../services/ttsProviders/GoogleTTSBetaProvider.js';

// Create hoisted mocks
const mockSynthesizeSpeech = vi.hoisted(() => vi.fn());

vi.mock('@google-cloud/text-to-speech', () => ({
  v1beta1: {
    TextToSpeechClient: class {
      synthesizeSpeech = mockSynthesizeSpeech;
    },
  },
  protos: {
    google: {
      cloud: {
        texttospeech: {
          v1beta1: {
            SynthesizeSpeechRequest: {
              TimepointType: {
                SSML_MARK: 1,
              },
            },
          },
        },
      },
    },
  },
}));

describe('GoogleTTSBetaProvider', () => {
  let provider: GoogleTTSBetaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleTTSBetaProvider();
  });

  describe('getName', () => {
    it('should return the provider name', () => {
      expect(provider.getName()).toBe('Google Cloud TTS (v1beta1 with timepoints)');
    });
  });

  describe('extractLanguageCode', () => {
    it('should extract ja-JP from Japanese voice ID', () => {
      expect(provider.extractLanguageCode('ja-JP-Neural2-B')).toBe('ja-JP');
    });

    it('should extract en-US from English voice ID', () => {
      expect(provider.extractLanguageCode('en-US-Neural2-A')).toBe('en-US');
    });

    it('should extract es-ES from Spanish voice ID', () => {
      expect(provider.extractLanguageCode('es-ES-Wavenet-C')).toBe('es-ES');
    });

    it('should default to en-US for unrecognized patterns', () => {
      expect(provider.extractLanguageCode('custom-voice')).toBe('en-US');
    });
  });

  describe('synthesizeSpeechWithTimepoints', () => {
    it('should synthesize speech and return timepoints', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [
        { markName: 'text_0', timeSeconds: 0.0 },
        { markName: 'text_1', timeSeconds: 1.5 },
      ];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello<mark name="text_1"/>World</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
      });

      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioBuffer.toString()).toBe('audio data');
      expect(result.timepoints).toHaveLength(2);
      expect(result.timepoints[0]).toEqual({ markName: 'text_0', timeSeconds: 0.0 });
      expect(result.timepoints[1]).toEqual({ markName: 'text_1', timeSeconds: 1.5 });
    });

    it('should include SSML_MARK in enableTimePointing', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [{ markName: 'text_0', timeSeconds: 0.0 }];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          enableTimePointing: [1], // SSML_MARK = 1
        })
      );
    });

    it('should apply custom speed', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [{ markName: 'text_0', timeSeconds: 0.0 }];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
        speed: 0.75,
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            speakingRate: 0.75,
          }),
        })
      );
    });

    it('should convert pitch from Hz to semitones', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [{ markName: 'text_0', timeSeconds: 0.0 }];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
        pitch: 9, // 9 Hz = 3 semitones
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            pitch: 3,
          }),
        })
      );
    });

    it('should throw error when no audio content is returned', async () => {
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent: null, timepoints: [] }]);

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'en-US-Neural2-A',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('No audio content received from Google Cloud TTS v1beta1');
    });

    it('should throw error when no timepoints are returned', async () => {
      const audioContent = Buffer.from('audio data');
      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints: [] }]);

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'en-US-Neural2-A',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('v1beta1 API did not return timepoints');
    });

    it('should handle null/undefined timepoint values gracefully', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [
        { markName: null, timeSeconds: null },
        { markName: 'text_1', timeSeconds: 2.0 },
      ];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello<mark name="text_1"/>World</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
      });

      expect(result.timepoints[0]).toEqual({ markName: '', timeSeconds: 0 });
      expect(result.timepoints[1]).toEqual({ markName: 'text_1', timeSeconds: 2.0 });
    });

    it('should wrap API errors with descriptive message', async () => {
      mockSynthesizeSpeech.mockRejectedValue(new Error('Quota exceeded'));

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'en-US-Neural2-A',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('Failed to synthesize speech with timepoints: Quota exceeded');
    });

    it('should handle non-Error exceptions', async () => {
      mockSynthesizeSpeech.mockRejectedValue('string error');

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'en-US-Neural2-A',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('Failed to synthesize speech with timepoints: Unknown error');
    });

    it('should use default speed of 1.0', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [{ markName: 'text_0', timeSeconds: 0.0 }];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            speakingRate: 1.0,
          }),
        })
      );
    });

    it('should use default pitch of 0', async () => {
      const audioContent = Buffer.from('audio data');
      const timepoints = [{ markName: 'text_0', timeSeconds: 0.0 }];

      mockSynthesizeSpeech.mockResolvedValue([{ audioContent, timepoints }]);

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'en-US-Neural2-A',
        languageCode: 'en-US',
      });

      expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          audioConfig: expect.objectContaining({
            pitch: 0,
          }),
        })
      );
    });
  });

  describe('getGoogleTTSBetaProvider singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getGoogleTTSBetaProvider();
      const instance2 = getGoogleTTSBetaProvider();
      expect(instance1).toBe(instance2);
    });
  });
});
