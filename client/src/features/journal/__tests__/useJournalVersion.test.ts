import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useJournalVersion, { journalVersionPrefix } from '../useJournalVersion';
import { removeJournalDeviceData } from '../journalDeviceCleanup';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('isolates entries and accounts when props change without remounting', () => {
  const { result, rerender } = renderHook(
    ({ owner, entry }) => useJournalVersion(owner, entry, true),
    { initialProps: { owner: 'a', entry: 'one' } }
  );
  act(() => result.current[1]('draft'));
  rerender({ owner: 'a', entry: 'two' });
  expect(result.current[0]).toBe('final');
  rerender({ owner: 'b', entry: 'one' });
  expect(result.current[0]).toBe('final');
  rerender({ owner: 'a', entry: 'one' });
  expect(result.current[0]).toBe('draft');
});

it('ignores invalid preferences and falls back to Draft when Final is unavailable', () => {
  localStorage.setItem(`${journalVersionPrefix('a')}one`, 'invalid');
  const { result, rerender } = renderHook(({ ready }) => useJournalVersion('a', 'one', ready), {
    initialProps: { ready: false },
  });
  expect(result.current[0]).toBe('draft');
  rerender({ ready: true });
  expect(result.current[0]).toBe('final');
  act(() => result.current[1]('draft'));
  rerender({ ready: false });
  rerender({ ready: true });
  expect(result.current[0]).toBe('draft');
});

it('keeps switching usable when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  const { result } = renderHook(() => useJournalVersion('a', 'one', true));
  act(() => result.current[1]('draft'));
  expect(result.current[0]).toBe('draft');
});

it('removes preferences on entry and account deletion without touching another account', () => {
  const { result } = renderHook(() => useJournalVersion('a', 'one', true));
  act(() => result.current[1]('draft'));
  localStorage.setItem(`${journalVersionPrefix('a')}two`, 'draft');
  localStorage.setItem(`${journalVersionPrefix('ab')}one`, 'draft');
  removeJournalDeviceData('a', 'one');
  expect(localStorage.getItem(`${journalVersionPrefix('a')}one`)).toBeNull();
  expect(localStorage.getItem(`${journalVersionPrefix('a')}two`)).toBe('draft');
  removeJournalDeviceData('a');
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem(`${journalVersionPrefix('ab')}one`)).toBe('draft');
});
