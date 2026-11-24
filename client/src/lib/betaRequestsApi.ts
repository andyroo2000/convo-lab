import { requestJson } from './apiClient';

export interface BetaRequest {
  id: string;
  email: string;
  devices: string[];
  message: string;
  createdAt: string;
  approvedAt: string | null;
  invitationSentAt: string | null;
  inviteCode: string | null;
  redeemedAt: string | null;
}
export type BetaRequestFilter = 'pending' | 'invited' | 'all';
export interface BetaRequestPage {
  requests: BetaRequest[];
  currentPage: number;
  lastPage: number;
  total: number;
}
const endpoint = '/api/convolab/admin/beta-requests';
export const getBetaRequests = (status: BetaRequestFilter, page: number, signal: AbortSignal) =>
  requestJson<BetaRequestPage>(`${endpoint}?status=${status}&page=${page}`, { signal });
export const approveBetaRequest = (id: string) =>
  requestJson<BetaRequest>(`${endpoint}/${encodeURIComponent(id)}/approve`, { method: 'POST' });
