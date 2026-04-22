import { describe, expect, it } from 'vitest';

import {
  isAllowedStudyImportZipEntryName,
  isSafeZipBasename,
  isUnsafeZipPath,
  normalizeFilename,
} from '../../../services/study/shared/paths.js';

describe('study shared paths', () => {
  it('rejects unsafe zip paths', () => {
    expect(isUnsafeZipPath('../../evil')).toBe(true);
    expect(isUnsafeZipPath('/tmp/evil')).toBe(true);
    expect(isUnsafeZipPath('C:\\evil')).toBe(true);
    expect(isUnsafeZipPath('media/safe.mp3')).toBe(false);
  });

  it('only allows study import archive entries that match the allowlist', () => {
    expect(isAllowedStudyImportZipEntryName('collection.anki21')).toBe(true);
    expect(isAllowedStudyImportZipEntryName('media')).toBe(true);
    expect(isAllowedStudyImportZipEntryName('safe.mp3')).toBe(true);
    expect(isAllowedStudyImportZipEntryName('../../evil.mp3')).toBe(false);
  });

  it('normalizes filenames and safe basenames', () => {
    expect(normalizeFilename('../a bad:file.mp3')).toBe('a_bad_file.mp3');
    expect(isSafeZipBasename('safe.mp3')).toBe(true);
    expect(isSafeZipBasename('../safe.mp3')).toBe(false);
  });
});
