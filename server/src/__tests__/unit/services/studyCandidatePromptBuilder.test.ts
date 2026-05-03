import { describe, expect, it } from 'vitest';

import { buildCandidateSystemInstruction } from '../../../services/study/candidates/promptBuilder.js';

describe('study candidate prompt builder', () => {
  it('adds image and example-sentence guardrails to generated candidates', () => {
    const instruction = buildCandidateSystemInstruction();

    expect(instruction).toContain('No text');
    expect(instruction).toContain('flashcard');
    expect(instruction).toContain('Avoid generic dictionary-style examples');
    expect(instruction).toContain('今日は曇りです。');
    expect(instruction).toContain('concrete situation, time, place, or speaker intention');
  });
});
