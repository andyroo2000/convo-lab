import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSSMLWithPauses,
  createSSMLSlow,
  createLessonSSML,
  createAnticipationPromptSSML,
} from '../../../services/ttsClient.js';

// Note: synthesizeSpeech and generateSilence require complex provider mocking
// These tests cover the SSML helper functions which are pure functions

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
