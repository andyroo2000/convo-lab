import { promises as fs } from 'fs';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  findAccessibleLocalStudyMediaPath,
  isAllowedStudyImportZipEntryName,
  isSafeZipBasename,
  isUnsafeZipPath,
  normalizeFilename,
  shouldMirrorStudyMediaLocally,
} from '../../../services/study/shared/paths.js';

describe('study shared paths', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLocalMirror = process.env.STUDY_MEDIA_LOCAL_MIRROR;

  afterEach(() => {
    if (typeof originalNodeEnv === 'undefined') {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (typeof originalLocalMirror === 'undefined') {
      delete process.env.STUDY_MEDIA_LOCAL_MIRROR;
    } else {
      process.env.STUDY_MEDIA_LOCAL_MIRROR = originalLocalMirror;
    }
  });

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

  it('finds legacy study media under the workspace public directory in development', async () => {
    const storagePath = 'study-media/path-test/audio.mp3';
    const absolutePath = path.join(process.cwd(), 'public', storagePath);

    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, 'audio');

      await expect(findAccessibleLocalStudyMediaPath(storagePath)).resolves.toBe(absolutePath);
    } finally {
      await fs.rm(path.join(process.cwd(), 'public/study-media/path-test'), {
        recursive: true,
        force: true,
      });
    }
  });

  it('allows an explicit env opt-out for local study media mirroring', () => {
    delete process.env.NODE_ENV;
    process.env.STUDY_MEDIA_LOCAL_MIRROR = 'false';

    expect(shouldMirrorStudyMediaLocally()).toBe(false);
  });

  it('allows an explicit env opt-in for local study media mirroring', () => {
    process.env.NODE_ENV = 'production';
    process.env.STUDY_MEDIA_LOCAL_MIRROR = 'true';

    expect(shouldMirrorStudyMediaLocally()).toBe(true);
  });
});
