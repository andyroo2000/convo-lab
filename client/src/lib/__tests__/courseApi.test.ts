import { describe, expect, it } from 'vitest';

import { createCourseApiContract } from '../courseApi';

describe('course API contract', () => {
  it('uses permanent Learning OS browser routes', () => {
    const contract = createCourseApiContract('https://app.example');

    expect(contract.collection).toBe('https://app.example/api/convolab/courses');
    expect(contract.member('course/123')).toBe(
      'https://app.example/api/convolab/courses/course%2F123'
    );
    expect(contract.operation('course/123', 'status')).toBe(
      'https://app.example/api/convolab/courses/course%2F123/status'
    );
  });
});
