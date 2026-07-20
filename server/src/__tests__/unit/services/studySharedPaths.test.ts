import { afterEach, describe, expect, it } from 'vitest';

import {
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

  it('normalizes filenames', () => {
    expect(normalizeFilename('../a bad:file.mp3')).toBe('a_bad_file.mp3');
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
