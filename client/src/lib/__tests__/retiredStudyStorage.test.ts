import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRetiredBrowserStudyStorage, clearRetiredStudyStorage } from '../retiredStudyStorage';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('retired study storage cleanup', () => {
  it('removes award state for all users while preserving other preferences', () => {
    const retiredKeys = [
      'convo-lab.study-achievement-sessions-v1.42',
      'convo-lab.study-milestones-v1.99',
      'convo-lab.study-deferred-achievements-v1.42',
      'convo-lab.study-presented-achievements-v1.99',
    ];
    retiredKeys.forEach((key) => localStorage.setItem(key, '{}'));
    localStorage.setItem('language', 'ja');
    clearRetiredStudyStorage(localStorage);
    retiredKeys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem('language')).toBe('ja');
  });
  it('keeps startup usable when storage access is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(clearRetiredBrowserStudyStorage).not.toThrow();
  });
});
