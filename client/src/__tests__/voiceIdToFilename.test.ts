import { describe, it, expect } from 'vitest';
// eslint-disable-next-line import/no-extraneous-dependencies
import { voiceIdToFilename } from '@languageflow/shared/src/voiceSelection';

describe('voiceIdToFilename', () => {
  describe('normal voice IDs', () => {
    it('should convert Fish Audio ID (colon to underscore)', () => {
      expect(voiceIdToFilename('fishaudio:abc123')).toBe('fishaudio_abc123');
    });

    it('should convert Fish Audio ID with full UUID', () => {
      expect(voiceIdToFilename('fishaudio:ac934b39586e475b83f3277cd97b5cd4')).toBe(
        'fishaudio_ac934b39586e475b83f3277cd97b5cd4'
      );
    });

    it('should convert Google voice ID to lowercase', () => {
      expect(voiceIdToFilename('ja-JP-Neural2-B')).toBe('ja-jp-neural2-b');
    });

    it('should convert Polly voice ID to lowercase', () => {
      expect(voiceIdToFilename('Takumi')).toBe('takumi');
    });

    it('should replace spaces with underscores', () => {
      expect(voiceIdToFilename('Jon Relaxed')).toBe('jon_relaxed');
    });

    it('should remove commas', () => {
      expect(voiceIdToFilename('Jon - Relaxed, Deep')).toBe('jon_-_relaxed_deep');
    });

    it('should handle multiple special characters', () => {
      expect(voiceIdToFilename('en-US-Neural2-J')).toBe('en-us-neural2-j');
    });
  });

  describe('security - path traversal', () => {
    it('should throw on path traversal with ../', () => {
      expect(() => voiceIdToFilename('../../../etc/passwd')).toThrow('Invalid voice ID');
    });

    it('should throw on path traversal with ..', () => {
      expect(() => voiceIdToFilename('..test')).toThrow('Invalid voice ID');
    });

    it('should throw on forward slash', () => {
      expect(() => voiceIdToFilename('/etc/passwd')).toThrow('Invalid voice ID');
    });

    it('should throw on embedded forward slash', () => {
      expect(() => voiceIdToFilename('foo/bar')).toThrow('Invalid voice ID');
    });
  });

  describe('edge cases', () => {
    it('should throw on empty string', () => {
      expect(() => voiceIdToFilename('')).toThrow('Invalid voice ID');
    });

    it('should throw when sanitization produces empty string', () => {
      expect(() => voiceIdToFilename('***')).toThrow(
        'Voice ID sanitization resulted in empty string'
      );
    });

    it('should handle single character ID', () => {
      expect(voiceIdToFilename('a')).toBe('a');
    });

    it('should handle numeric ID', () => {
      expect(voiceIdToFilename('12345')).toBe('12345');
    });
  });
});
