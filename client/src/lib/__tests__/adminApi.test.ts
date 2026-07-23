import { describe, expect, it } from 'vitest';

import { createAdminApiContract } from '../adminApi';

describe('admin API contract', () => {
  it.each([
    [false, '/api/admin'],
    [true, '/api/convolab/admin'],
  ])('selects the expected namespace when direct mode is %s', (direct, base) => {
    const contract = createAdminApiContract(direct, '');

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
    expect(contract.scriptLabCourse('course/id')).toBe(`${base}/script-lab/courses/course%2Fid`);
    expect(contract.scriptLabSentenceTests(50)).toBe(`${base}/script-lab/sentence-tests?limit=50`);
    expect(contract.adminCourseOperation('course/id', 'generate-audio')).toBe(
      `${base}/courses/course%2Fid/generate-audio`
    );
    expect(contract.adminCourseLineRendering('course/id', 'render/id')).toBe(
      `${base}/courses/course%2Fid/line-renderings/render%2Fid`
    );
  });

  it('keeps the deployment feature flag endpoint on Express', () => {
    expect(createAdminApiContract(true, 'https://app.test').featureFlags).toBe(
      'https://app.test/api/admin/feature-flags'
    );
  });
});
