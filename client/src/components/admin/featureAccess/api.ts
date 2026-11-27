import { requestJson } from '../../../lib/apiClient';
import type { AdminFeatureFlagKey } from '../../../lib/adminApi';

export interface AudienceUser {
  id: string;
  name: string;
  email: string;
  role: string;
  groupIds?: string[];
}
export interface AccessGroup {
  id: string;
  name: string;
  version: number;
  users: AudienceUser[];
  features: AdminFeatureFlagKey[];
}
export interface FeatureAudience {
  feature: AdminFeatureFlagKey;
  version: number;
  users: AudienceUser[];
  groupIds: string[];
}
export interface UserResults {
  users: AudienceUser[];
  total: number;
  page: number;
  lastPage: number;
}
const base = '/api/convolab/admin/feature-access';
export const getGroups = (signal?: AbortSignal) =>
  requestJson<{ groups: AccessGroup[] }>(`${base}/groups`, { signal });
export const getAudience = (feature: AdminFeatureFlagKey, signal?: AbortSignal) =>
  requestJson<FeatureAudience>(`${base}/audiences/${feature}`, { signal });
export const searchUsers = (filters: Record<string, string>, signal: AbortSignal) =>
  requestJson<UserResults>(`${base}/users?${new URLSearchParams(filters)}`, { signal });
export const saveAudience = (audience: FeatureAudience) =>
  requestJson<FeatureAudience>(`${base}/audiences/${audience.feature}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: audience.version,
      userIds: audience.users.map((u) => u.id),
      groupIds: audience.groupIds,
    }),
  });
export const saveGroup = (group: AccessGroup) =>
  requestJson<AccessGroup>(
    group.id ? `${base}/groups/${encodeURIComponent(group.id)}` : `${base}/groups`,
    {
      method: group.id ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: group.name,
        version: group.version,
        userIds: group.users.map((u) => u.id),
      }),
    }
  );
export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Could not load feature access. Try again.';

export const newGroup = (): AccessGroup => ({
  id: '',
  name: '',
  version: 0,
  users: [],
  features: [],
});
