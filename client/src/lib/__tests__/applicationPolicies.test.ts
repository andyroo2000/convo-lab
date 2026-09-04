import { describe, expect, it } from 'vitest';

import { isChunkLoadingError, shouldRetryQuery } from '../applicationPolicies';

describe('application policies', () => {
  describe('isChunkLoadingError', () => {
    it.each([
      'Failed to fetch dynamically imported module',
      'Loading chunk 42 failed',
      'ChunkLoadError: missing asset',
    ])('recognizes chunk failures reported in the event message', (message) => {
      expect(isChunkLoadingError(new ErrorEvent('error', { message }))).toBe(true);
    });

    it('recognizes a chunk failure on the attached error', () => {
      const event = new ErrorEvent('error', {
        message: 'Script error',
        error: new Error('ChunkLoadError: missing asset'),
      });

      expect(isChunkLoadingError(event)).toBe(true);
    });

    it('ignores unrelated errors', () => {
      expect(isChunkLoadingError(new ErrorEvent('error', { message: 'Network error' }))).toBe(
        false
      );
    });
  });

  describe('shouldRetryQuery', () => {
    it.each([400, 404, 499])('does not retry HTTP %s responses', (status) => {
      expect(shouldRetryQuery(0, { response: { status } })).toBe(false);
    });

    it.each([399, 500])('retries HTTP %s responses within the retry limit', (status) => {
      expect(shouldRetryQuery(0, { response: { status } })).toBe(true);
    });

    it('retries unknown errors twice', () => {
      expect(shouldRetryQuery(0, new Error('offline'))).toBe(true);
      expect(shouldRetryQuery(1, new Error('offline'))).toBe(true);
      expect(shouldRetryQuery(2, new Error('offline'))).toBe(false);
    });

    it('does not treat malformed response values as client errors', () => {
      expect(shouldRetryQuery(0, { response: { status: '404' } })).toBe(true);
      expect(shouldRetryQuery(0, { response: null })).toBe(true);
    });
  });
});
