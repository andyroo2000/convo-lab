import { describe, expect, it } from 'vitest';

import { createAdminApiContract } from '../adminApi';

describe('admin API contract', () => {
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

  it('keeps the deployment feature flag endpoint on Express', () => {
    expect(createAdminApiContract('https://app.test').featureFlags).toBe(
      'https://app.test/api/admin/feature-flags'
    );
  });
});
