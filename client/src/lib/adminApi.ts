import { requestJson } from './apiClient';

type AdminCourseOperation =
  | 'build-prompt'
  | 'build-script-config'
  | 'generate-dialogue'
  | 'generate-script'
  | 'generate-audio'
  | 'pipeline-data'
  | 'synthesize-line'
  | 'line-renderings';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  role: string;
  createdAt: string;
  _count: {
    episodes: number;
    courses: number;
  };
}

export interface AdminInviteCode {
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminStats {
  users: number;
  episodes: number;
  courses: number;
  inviteCodes: {
    total: number;
    used: number;
    available: number;
  };
}

export interface AdminSpeakerAvatar {
  id: string;
  filename: string;
  croppedUrl: string;
  originalUrl: string;
  language: string;
  gender: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  scriptsEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
  updatedAt: string;
}

export type AdminFeatureFlagKey = keyof Omit<AdminFeatureFlags, 'id' | 'updatedAt'>;

export interface AdminPronunciationDictionary {
  keepKanji: string[];
  forceKana: Record<string, string>;
  verbKana?: Record<string, string>;
  updatedAt?: string;
}

export interface AdminPronunciationDictionaryUpdate {
  keepKanji: string[];
  forceKana: Record<string, string>;
  verbKana: Record<string, string>;
}

interface AdminUsersResponse {
  users: AdminUser[];
}

export type AdminReadRequestInit = Pick<RequestInit, 'signal'>;

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
    featureFlags: `${apiUrl}/api/feature-flags`,
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

export async function getAdminUsers(
  search: string,
  init?: AdminReadRequestInit
): Promise<AdminUser[]> {
  const response = await requestJson<AdminUsersResponse>(adminApi.users(search), init);
  return response.users;
}

export function getAdminInviteCodes(init?: AdminReadRequestInit): Promise<AdminInviteCode[]> {
  return requestJson<AdminInviteCode[]>(adminApi.inviteCodes, init);
}

export function getAdminStats(init?: AdminReadRequestInit): Promise<AdminStats> {
  return requestJson<AdminStats>(adminApi.stats, init);
}

export function getAdminSpeakerAvatars(
  cacheBust?: number,
  init?: AdminReadRequestInit
): Promise<AdminSpeakerAvatar[]> {
  return requestJson<AdminSpeakerAvatar[]>(adminApi.speakerAvatars(cacheBust), init);
}

export function getAdminFeatureFlags(init?: AdminReadRequestInit): Promise<AdminFeatureFlags> {
  return requestJson<AdminFeatureFlags>(adminApi.featureFlags, init);
}

export function updateAdminFeatureFlag(
  key: AdminFeatureFlagKey,
  value: boolean
): Promise<AdminFeatureFlags> {
  return requestJson<AdminFeatureFlags>(adminApi.featureFlags, {
    method: 'PATCH',
    body: JSON.stringify({ [key]: value }),
  });
}

export function getAdminPronunciationDictionary(
  init?: AdminReadRequestInit
): Promise<AdminPronunciationDictionary> {
  return requestJson<AdminPronunciationDictionary>(adminApi.pronunciationDictionaries, init);
}

export function updateAdminPronunciationDictionary(
  dictionary: AdminPronunciationDictionaryUpdate
): Promise<AdminPronunciationDictionary> {
  return requestJson<AdminPronunciationDictionary>(adminApi.pronunciationDictionaries, {
    method: 'PUT',
    body: JSON.stringify(dictionary),
  });
}
