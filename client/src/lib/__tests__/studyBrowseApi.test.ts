import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStudyBrowser, getStudyBrowserNoteDetail } from '../studyBrowseApi';

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  requestJson: requestJsonMock,
}));

describe('studyBrowseApi', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('routes the typed browser query through the canonical client', async () => {
    const result = { rows: [], total: 0, limit: 25, nextCursor: null };
    const controller = new AbortController();
    requestJsonMock.mockResolvedValue(result);

    await expect(
      getStudyBrowser(
        {
          q: '日本語 文法',
          noteType: 'Japanese / Grammar',
          cardType: 'recognition',
          queueState: 'review',
          sortField: 'created_on',
          sortDirection: 'desc',
          cursor: 'cursor/1',
          limit: 25,
        },
        { signal: controller.signal }
      )
    ).resolves.toBe(result);

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/api/study/browser?q=%E6%97%A5%E6%9C%AC%E8%AA%9E+%E6%96%87%E6%B3%95&noteType=Japanese+%2F+Grammar&cardType=recognition&queueState=review&sortField=created_on&sortDirection=desc&cursor=cursor%2F1&limit=25',
      { signal: controller.signal }
    );
  });

  it('encodes note IDs and forwards cancellation to detail requests', async () => {
    const detail = { noteId: 'note/with spaces', cards: [] };
    const controller = new AbortController();
    requestJsonMock.mockResolvedValue(detail);

    await expect(
      getStudyBrowserNoteDetail('note/with spaces', { signal: controller.signal })
    ).resolves.toBe(detail);
    expect(requestJsonMock).toHaveBeenCalledWith('/api/study/browser/note%2Fwith%20spaces', {
      signal: controller.signal,
    });
  });
});
