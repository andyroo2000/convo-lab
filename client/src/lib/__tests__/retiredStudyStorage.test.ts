import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRetiredBrowserStudyStorage, clearRetiredStudyStorage } from '../retiredStudyStorage';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('retired study storage cleanup', () => {
  it('removes award state for all users while preserving other preferences', () => {
    localStorage.setItem('convo-lab.study-achievement-sessions-v1.42', '{}');
    localStorage.setItem('convo-lab.study-milestones-v1.99', '{}');
    localStorage.setItem('language', 'ja');
    clearRetiredStudyStorage(localStorage);
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('language')).toBe('ja');
  });
  it('keeps startup usable when storage access is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(clearRetiredBrowserStudyStorage).not.toThrow();
  });
});
