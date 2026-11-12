import { beforeEach, expect, it, vi } from 'vitest';
import {
  removeDeletedAccountJournal,
  removeJournalDeviceData,
  retryJournalDeviceCleanup,
} from '../journalDeviceCleanup';

beforeEach(() => localStorage.clear());

it('deletes one entry and its answers while preserving other writing', () => {
  localStorage.setItem('convolab:journal:v1:1:entry', 'draft');
  localStorage.setItem('convolab:journal-answer:1:entry:analysis', 'answer');
  localStorage.setItem('convolab:journal:v1:1:entry2', 'other entry');
  localStorage.setItem('convolab:journal:v1:11:entry', 'other user');
  removeJournalDeviceData('1', 'entry');
  expect(localStorage.length).toBe(2);
  expect(localStorage.getItem('convolab:journal:v1:1:entry2')).toBe('other entry');
  expect(localStorage.getItem('convolab:journal:v1:11:entry')).toBe('other user');
});

it('removes all writing only for the confirmed deleted account', () => {
  localStorage.setItem('convolab:journal:v1:1:entry', 'draft');
  localStorage.setItem('convolab:journal-answer:1:entry:analysis', 'answer');
  localStorage.setItem('convolab:journal-answer:11:entry:analysis', 'other user');
  removeDeletedAccountJournal('1');
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem('convolab:journal-answer:11:entry:analysis')).toBe('other user');
});

it('retains a cleanup marker after failure and retries it on a later session', () => {
  localStorage.setItem('convolab:journal:v1:1:entry', 'draft');
  const failure = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
    throw new Error('Storage unavailable');
  });
  expect(() => removeDeletedAccountJournal('1')).toThrow();
  failure.mockRestore();
  expect(localStorage.getItem('convolab:journal-account-deletion:1')).toBe('pending');
  retryJournalDeviceCleanup();
  expect(localStorage.length).toBe(0);
});
