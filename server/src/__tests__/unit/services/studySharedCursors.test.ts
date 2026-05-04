import { describe, expect, it } from 'vitest';

import { normalizeStudyBrowserCursor } from '../../../services/study/browserSort.js';
import {
  decodeStudyBrowserCursor,
  decodeStudyExportCursor,
  encodeStudyBrowserCursor,
  encodeStudyExportCursor,
} from '../../../services/study/shared/cursors.js';

describe('study shared cursors', () => {
  it('round-trips browser and export cursors', () => {
    const browserCursor = {
      updatedAt: '2026-04-22T12:00:00.000Z',
      id: 'note-1',
    };
    const exportCursor = {
      timestamp: '2026-04-22T12:00:00.000Z',
      id: 'card-1',
    };

    expect(decodeStudyBrowserCursor(encodeStudyBrowserCursor(browserCursor))).toEqual(
      browserCursor
    );
    expect(decodeStudyExportCursor(encodeStudyExportCursor(exportCursor))).toEqual(exportCursor);
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeStudyBrowserCursor('not-a-cursor')).toThrow(/cursor is invalid/i);
  });

  it('ignores legacy browser cursors when the current sort is not the legacy sort', () => {
    expect(
      normalizeStudyBrowserCursor({
        cursor: {
          updatedAt: '2026-04-22T12:00:00.000Z',
          id: 'note-1',
        },
        sortField: 'created_on',
        sortDirection: 'desc',
      })
    ).toBeNull();
  });
});
