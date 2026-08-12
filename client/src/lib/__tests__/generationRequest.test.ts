import { describe, expect, it } from 'vitest';
import { JsonRequestError } from '../apiClient';
import { isDefinitiveGenerationRejection } from '../generationRequest';

describe('isDefinitiveGenerationRejection', () => {
  it.each([
    [400, true],
    [401, false],
    [403, false],
    [404, true],
    [409, false],
    [410, false],
    [422, true],
    [429, false],
    [500, false],
  ])('classifies HTTP %i as definitive=%s', (status, expected) => {
    expect(isDefinitiveGenerationRejection(new JsonRequestError('Rejected', status, null))).toBe(
      expected
    );
  });
});
