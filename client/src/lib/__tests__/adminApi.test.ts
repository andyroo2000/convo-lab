import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAdminApiContract,
  getAdminStats,
  getAdminUsers,
  getAdminInviteCodes,
  getAdminSpeakerAvatars,
} from '../adminApi';

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
}));

vi.mock('../apiClient', () => ({
  requestJson: requestJsonMock,
}));

describe('admin API contract', () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
  });

  it('uses the permanent Learning OS namespace', () => {
    const base = '/api/convolab/admin';
    const contract = createAdminApiContract('');

    expect(contract.stats).toBe(`${base}/stats`);
    expect(contract.users('name+tag@example.com')).toBe(
      `${base}/users?search=name%2Btag%40example.com`
    );
    expect(contract.user('user/id')).toBe(`${base}/users/user%2Fid`);
    expect(contract.userInfo('user/id')).toBe(`${base}/users/user%2Fid/info`);
    expect(contract.inviteCodes).toBe(`${base}/invite-codes`);
    expect(contract.inviteCode('invite/id')).toBe(`${base}/invite-codes/invite%2Fid`);
    expect(contract.speakerAvatars(123)).toBe(`${base}/avatars/speakers?t=123`);
    expect(contract.speakerAvatarOriginal('ja/female.png')).toBe(
      `${base}/avatars/speaker/ja%2Ffemale.png/original`
    );
    expect(contract.userAvatarUpload('user/id')).toBe(`${base}/avatars/user/user%2Fid/upload`);
    expect(contract.pronunciationDictionaries).toBe(`${base}/pronunciation-dictionaries`);
    expect(contract.scriptLabCourses).toBe(`${base}/script-lab/courses`);
    expect(contract.scriptLabCourse('course/id')).toBe(`${base}/script-lab/courses/course%2Fid`);
    expect(contract.scriptLabTestPronunciation).toBe(`${base}/script-lab/test-pronunciation`);
    expect(contract.scriptLabSentenceScript).toBe(`${base}/script-lab/sentence-script`);
    expect(contract.scriptLabSentenceTests()).toBe(`${base}/script-lab/sentence-tests`);
    expect(contract.scriptLabSentenceTests(50)).toBe(`${base}/script-lab/sentence-tests?limit=50`);
    expect(contract.scriptLabSentenceTest('test/id')).toBe(
      `${base}/script-lab/sentence-tests/test%2Fid`
    );
    expect(contract.scriptLabSynthesizeLine).toBe(`${base}/script-lab/synthesize-line`);
    expect(contract.adminCourseOperation('course/id', 'generate-audio')).toBe(
      `${base}/courses/course%2Fid/generate-audio`
    );
    expect(contract.adminCourseLineRendering('course/id', 'render/id')).toBe(
      `${base}/courses/course%2Fid/line-renderings/render%2Fid`
    );
  });

  it('uses the canonical Learning OS feature flag endpoint', () => {
    expect(createAdminApiContract('https://app.test').featureFlags).toBe(
      'https://app.test/api/feature-flags'
    );
  });

  it('normalizes dashboard reads through the shared JSON client', async () => {
    const controller = new AbortController();
    const users = [
      {
        id: 'user-1',
        email: 'learner@example.com',
        name: 'Learner',
        role: 'user',
        createdAt: '2026-01-01T00:00:00.000Z',
        _count: { episodes: 2, courses: 1 },
      },
    ];
    const inviteCodes = [
      {
        id: 'invite-1',
        code: 'WELCOME',
        usedBy: null,
        usedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const stats = {
      users: 1,
      episodes: 2,
      courses: 1,
      inviteCodes: { total: 1, used: 0, available: 1 },
    };
    requestJsonMock
      .mockResolvedValueOnce({ users })
      .mockResolvedValueOnce(inviteCodes)
      .mockResolvedValueOnce(stats);

    await expect(
      getAdminUsers('name+tag@example.com', { signal: controller.signal })
    ).resolves.toEqual(users);
    await expect(getAdminInviteCodes({ signal: controller.signal })).resolves.toBe(inviteCodes);
    await expect(getAdminStats({ signal: controller.signal })).resolves.toBe(stats);

    expect(requestJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/convolab/admin/users?search=name%2Btag%40example.com',
      { signal: controller.signal }
    );
    expect(requestJsonMock).toHaveBeenNthCalledWith(2, '/api/convolab/admin/invite-codes', {
      signal: controller.signal,
    });
    expect(requestJsonMock).toHaveBeenNthCalledWith(3, '/api/convolab/admin/stats', {
      signal: controller.signal,
    });
  });

  it('loads speaker avatars through the shared JSON client with cancellation and cache busting', async () => {
    const controller = new AbortController();
    const avatars = [
      {
        id: 'avatar-1',
        filename: 'ja-female-casual.jpg',
        croppedUrl: 'https://example.com/cropped.jpg',
        originalUrl: 'https://example.com/original.jpg',
        language: 'ja',
        gender: 'female',
        tone: 'casual',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    requestJsonMock.mockResolvedValue(avatars);

    await expect(getAdminSpeakerAvatars(123, { signal: controller.signal })).resolves.toBe(avatars);
    expect(requestJsonMock).toHaveBeenCalledWith('/api/convolab/admin/avatars/speakers?t=123', {
      signal: controller.signal,
    });
  });
});
