import { describe, expect, it } from 'vitest';
import { chapterPosition } from '../landingScroll';

describe('landing scroll position', () => {
  it('holds each chapter for reading before moving sideways', () => {
    expect(chapterPosition(0, 4000, 800, 4)).toBe(0);
    expect(chapterPosition(-400, 4000, 800, 4)).toBe(0);
    expect(chapterPosition(-660, 4000, 800, 4)).toBeCloseTo(0.5);
    expect(chapterPosition(-800, 4000, 800, 4)).toBe(1);
  });
  it('keeps the first and final panels stable outside the story', () => {
    expect(chapterPosition(100, 4000, 800, 4)).toBe(0);
    expect(chapterPosition(-5000, 4000, 800, 4)).toBe(3);
  });
});
