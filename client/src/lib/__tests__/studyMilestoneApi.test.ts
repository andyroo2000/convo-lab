import { beforeEach, describe, expect, it, vi } from 'vitest';

import { evaluateStudyMilestones, presentStudyMilestones } from '../studyMilestoneApi';

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  requestJson: requestJsonMock,
}));

describe('studyMilestoneApi', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('decodes the server ledger and pending presentation list', async () => {
    const award = {
      id: 'burned100',
      earnedAt: '2026-08-25T12:00:00.000Z',
      presentedAt: null,
    };
    requestJsonMock.mockResolvedValue({ milestones: [award], pendingMilestones: [award] });

    await expect(evaluateStudyMilestones()).resolves.toEqual({
      milestones: [award],
      pendingMilestones: [award],
    });
    expect(requestJsonMock).toHaveBeenCalledWith('/api/study/milestones/evaluate', {
      method: 'POST',
    });
  });

  it.each([
    null,
    {},
    { milestones: {}, pendingMilestones: [] },
    {
      milestones: [{ id: 'unknown', earnedAt: '2026-08-25T12:00:00.000Z', presentedAt: null }],
      pendingMilestones: [],
    },
  ])('rejects malformed milestone responses %#', async (response) => {
    requestJsonMock.mockResolvedValue(response);

    await expect(evaluateStudyMilestones()).rejects.toThrow(/Milestone response/);
  });

  it('acknowledges presented milestone IDs through the canonical client', async () => {
    requestJsonMock.mockResolvedValue(undefined);

    await presentStudyMilestones(['burned100', 'burned500']);

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/api/study/milestones/present',
      {
        method: 'POST',
        body: JSON.stringify({ milestoneIds: ['burned100', 'burned500'] }),
      },
      { acceptedEmptyStatuses: [204] }
    );
  });

  it('does not send an empty presentation acknowledgement', async () => {
    await presentStudyMilestones([]);

    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});
