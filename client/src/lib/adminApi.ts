type AdminCourseOperation =
  | 'build-prompt'
  | 'build-script-config'
  | 'generate-dialogue'
  | 'generate-script'
  | 'generate-audio'
  | 'pipeline-data'
  | 'synthesize-line'
  | 'line-renderings';

export interface AdminApiContract {
  stats: string;
  users: (search?: string) => string;
  user: (userId: string) => string;
  userInfo: (userId: string) => string;
  inviteCodes: string;
  inviteCode: (inviteId: string) => string;
  featureFlags: string;
  speakerAvatars: (cacheBust?: number) => string;
  speakerAvatarOriginal: (filename: string) => string;
  speakerAvatarUpload: (filename: string) => string;
  speakerAvatarRecrop: (filename: string) => string;
  userAvatarUpload: (userId: string) => string;
  pronunciationDictionaries: string;
  scriptLabCourses: string;
  scriptLabCourse: (courseId: string) => string;
  scriptLabTestPronunciation: string;
  scriptLabSentenceScript: string;
  scriptLabSentenceTests: (limit?: number) => string;
  scriptLabSentenceTest: (testId: string) => string;
  scriptLabSynthesizeLine: string;
  adminCourseOperation: (courseId: string, operation: AdminCourseOperation) => string;
  adminCourseLineRendering: (courseId: string, renderingId: string) => string;
}

export function createAdminApiContract(apiUrl = ''): AdminApiContract {
  const base = `${apiUrl}/api/convolab/admin`;
  const users = `${base}/users`;
  const inviteCodes = `${base}/invite-codes`;
  const speakerAvatars = `${base}/avatars/speakers`;
  const scriptLab = `${base}/script-lab`;
  const adminCourses = `${base}/courses`;
  const encode = encodeURIComponent;

  return {
    stats: `${base}/stats`,
    users: (search) => (search === undefined ? users : `${users}?search=${encode(search)}`),
    user: (userId) => `${users}/${encode(userId)}`,
    userInfo: (userId) => `${users}/${encode(userId)}/info`,
    inviteCodes,
    inviteCode: (inviteId) => `${inviteCodes}/${encode(inviteId)}`,
    // Deployment feature flags configure both services and remain Express-owned.
    featureFlags: `${apiUrl}/api/admin/feature-flags`,
    speakerAvatars: (cacheBust) =>
      cacheBust === undefined ? speakerAvatars : `${speakerAvatars}?t=${cacheBust}`,
    speakerAvatarOriginal: (filename) => `${base}/avatars/speaker/${encode(filename)}/original`,
    speakerAvatarUpload: (filename) => `${base}/avatars/speaker/${encode(filename)}/upload`,
    speakerAvatarRecrop: (filename) => `${base}/avatars/speaker/${encode(filename)}/recrop`,
    userAvatarUpload: (userId) => `${base}/avatars/user/${encode(userId)}/upload`,
    pronunciationDictionaries: `${base}/pronunciation-dictionaries`,
    scriptLabCourses: `${scriptLab}/courses`,
    scriptLabCourse: (courseId) => `${scriptLab}/courses/${encode(courseId)}`,
    scriptLabTestPronunciation: `${scriptLab}/test-pronunciation`,
    scriptLabSentenceScript: `${scriptLab}/sentence-script`,
    scriptLabSentenceTests: (limit) =>
      limit === undefined
        ? `${scriptLab}/sentence-tests`
        : `${scriptLab}/sentence-tests?limit=${limit}`,
    scriptLabSentenceTest: (testId) => `${scriptLab}/sentence-tests/${encode(testId)}`,
    scriptLabSynthesizeLine: `${scriptLab}/synthesize-line`,
    adminCourseOperation: (courseId, operation) =>
      `${adminCourses}/${encode(courseId)}/${operation}`,
    adminCourseLineRendering: (courseId, renderingId) =>
      `${adminCourses}/${encode(courseId)}/line-renderings/${encode(renderingId)}`,
  };
}

export const adminApi = createAdminApiContract();
