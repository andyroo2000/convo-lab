import { describe, expect, it } from 'vitest';

import { createCourseApiContract } from '../courseApi';

describe('course API contract', () => {
  it('preserves legacy Express routes while disabled', () => {
    const contract = createCourseApiContract(false, 'https://app.example');

    expect(contract.collection).toBe('https://app.example/api/courses');
    expect(contract.member('course-123')).toBe('https://app.example/api/courses/course-123');
    expect(contract.operation('course-123', 'generate')).toBe(
      'https://app.example/api/courses/course-123/generate'
    );
  });

  it('uses Learning OS browser routes while enabled', () => {
    const contract = createCourseApiContract(true, 'https://app.example');

    expect(contract.collection).toBe('https://app.example/api/convolab/courses');
    expect(contract.member('course/123')).toBe(
      'https://app.example/api/convolab/courses/course%2F123'
    );
    expect(contract.operation('course/123', 'status')).toBe(
      'https://app.example/api/convolab/courses/course%2F123/status'
    );
  });
});
