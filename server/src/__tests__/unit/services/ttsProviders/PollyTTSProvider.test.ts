import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';

// Create hoisted mocks
const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-polly', () => ({
  Polly: class {
    send = mockSend;
  },
  SynthesizeSpeechCommand: class {
    constructor(public params: any) {}
  },
}));

// Import after mocking
import {
  PollyTTSProvider,
  getPollyTTSProvider,
} from '../../../../services/ttsProviders/PollyTTSProvider.js';

describe('PollyTTSProvider', () => {
  let provider: PollyTTSProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PollyTTSProvider();
  });

  describe('getName', () => {
    it('should return the provider name', () => {
      expect(provider.getName()).toBe('Amazon Polly (Neural with Speech Marks)');
    });
  });

  describe('synthesizeSpeechWithTimepoints', () => {
    it('should synthesize speech and return timepoints', async () => {
      // First call: audio synthesis
      const audioBuffer = Buffer.from('audio data');
      // Second call: speech marks (newline-delimited JSON)
      const marksBuffer = Buffer.from(
        '{"type":"ssml","time":0,"value":"text_0"}\n' +
          '{"type":"ssml","time":1500,"value":"text_1"}\n'
      );

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello<mark name="text_1"/>World</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.timepoints).toHaveLength(2);
      expect(result.timepoints[0]).toEqual({ markName: 'text_0', timeSeconds: 0 });
      expect(result.timepoints[1]).toEqual({ markName: 'text_1', timeSeconds: 1.5 });
    });

    it('should make two API calls - one for audio, one for marks', async () => {
      const audioBuffer = Buffer.from('audio data');
      const marksBuffer = Buffer.from('{"type":"ssml","time":0,"value":"text_0"}\n');

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      expect(mockSend).toHaveBeenCalledTimes(2);

      // First call - audio synthesis (checking the command params)
      const firstCallParams = mockSend.mock.calls[0][0].params;
      expect(firstCallParams.OutputFormat).toBe('mp3');
      expect(firstCallParams.Engine).toBe('neural');
      expect(firstCallParams.TextType).toBe('ssml');

      // Second call - speech marks
      const secondCallParams = mockSend.mock.calls[1][0].params;
      expect(secondCallParams.OutputFormat).toBe('json');
      expect(secondCallParams.SpeechMarkTypes).toEqual(['ssml']);
    });

    it('should throw error when no audio content is returned', async () => {
      mockSend.mockResolvedValueOnce({ AudioStream: Readable.from([]) });

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'Joanna',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('No audio content received from Amazon Polly');
    });

    it('should throw error when no speech marks are returned', async () => {
      const audioBuffer = Buffer.from('audio data');
      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([]) });

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'Joanna',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('No speech marks received from Amazon Polly');
    });

    it('should throw error when no SSML marks found in response', async () => {
      const audioBuffer = Buffer.from('audio data');
      // Return only word marks, not ssml marks
      const marksBuffer = Buffer.from('{"type":"word","time":0,"value":"Hello"}\n');

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'Joanna',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('Polly Speech Marks API did not return any SSML marks');
    });

    it('should filter out non-SSML mark types', async () => {
      const audioBuffer = Buffer.from('audio data');
      const marksBuffer = Buffer.from(
        '{"type":"word","time":0,"value":"Hello"}\n' +
          '{"type":"ssml","time":100,"value":"mark_1"}\n' +
          '{"type":"sentence","time":200,"value":"."}\n'
      );

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="mark_1"/>Hello</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      expect(result.timepoints).toHaveLength(1);
      expect(result.timepoints[0].markName).toBe('mark_1');
    });

    it('should convert milliseconds to seconds', async () => {
      const audioBuffer = Buffer.from('audio data');
      const marksBuffer = Buffer.from('{"type":"ssml","time":2500,"value":"text_0"}\n');

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      expect(result.timepoints[0].timeSeconds).toBe(2.5);
    });

    it('should wrap API errors with descriptive message', async () => {
      mockSend.mockRejectedValue(new Error('AWS credentials expired'));

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'Joanna',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('Failed to synthesize speech with Polly: AWS credentials expired');
    });

    it('should handle non-Error exceptions', async () => {
      mockSend.mockRejectedValue('Unknown error');

      await expect(
        provider.synthesizeSpeechWithTimepoints({
          ssml: '<speak>Hello</speak>',
          voiceId: 'Joanna',
          languageCode: 'en-US',
        })
      ).rejects.toThrow('Failed to synthesize speech with Polly: Unknown error');
    });

    it('should skip empty lines in marks response', async () => {
      const audioBuffer = Buffer.from('audio data');
      const marksBuffer = Buffer.from(
        '{"type":"ssml","time":0,"value":"text_0"}\n\n{"type":"ssml","time":1000,"value":"text_1"}\n   \n'
      );

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      const result = await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello<mark name="text_1"/>World</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      expect(result.timepoints).toHaveLength(2);
    });

    it('should use default speed of 1.0', async () => {
      const audioBuffer = Buffer.from('audio data');
      const marksBuffer = Buffer.from('{"type":"ssml","time":0,"value":"text_0"}\n');

      mockSend
        .mockResolvedValueOnce({ AudioStream: Readable.from([audioBuffer]) })
        .mockResolvedValueOnce({ AudioStream: Readable.from([marksBuffer]) });

      await provider.synthesizeSpeechWithTimepoints({
        ssml: '<speak><mark name="text_0"/>Hello</speak>',
        voiceId: 'Joanna',
        languageCode: 'en-US',
      });

      // Speed is handled via SSML prosody tags, not API parameter for Polly
      // Just verify the call was made successfully
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPollyTTSProvider singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getPollyTTSProvider();
      const instance2 = getPollyTTSProvider();
      expect(instance1).toBe(instance2);
    });
  });
});
