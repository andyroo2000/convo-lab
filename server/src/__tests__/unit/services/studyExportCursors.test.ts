import { describe, expect, it } from 'vitest';

import {
  decodeStudyExportCursor,
  encodeStudyExportCursor,
} from '../../../services/study/shared/cursors.js';

describe('study export cursors', () => {
  it('round-trips export cursors', () => {
    const exportCursor = {
      timestamp: '2026-04-22T12:00:00.000Z',
      id: 'card-1',
    };

    expect(decodeStudyExportCursor(encodeStudyExportCursor(exportCursor))).toEqual(exportCursor);
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeStudyExportCursor('not-a-cursor')).toThrow(/cursor is invalid/i);
  });
});
