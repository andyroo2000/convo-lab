import { requestJson } from './apiClient';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface WritingCounts {
  originals: number;
  followups: number;
  activeUsers: number;
  averageEntryCharacters: number | null;
  averageFollowupCharacters: number | null;
}
export interface WritingBucket extends WritingCounts {
  date: string;
}
export interface WriterCost {
  id: string;
  name: string;
  avatarUrl: string | null;
  entries: number;
  followups: number;
  inferenceUsd: number;
  ttsUsd: number;
  estimatedCostUsd: number;
  unknownRequests: number;
  dailyAverageUsd: number;
  projectedMonthlyUsd: number;
  breakdown: {
    category: string;
    operation: string;
    provider: string;
    model: string;
    estimatedUsd: number;
    requests: number;
    unknownRequests: number;
  }[];
}
export interface JournalAnalytics {
  activity: {
    period: AnalyticsPeriod;
    start: string;
    end: string;
    buckets: WritingBucket[];
    summary: WritingCounts & { averageFollowupsPerEntry: number | null };
  };
  month: {
    start: string;
    asOf: string;
    elapsedDays: number;
    daysInMonth: number;
    activeUsers: number;
    averageCostPerActiveUserUsd: number | null;
    projectedMonthlyCostPerActiveUserUsd: number | null;
    inferenceUsd: number;
    ttsUsd: number;
    unknownRequests: number;
    calendar: WritingBucket[];
    trackingSince: string | null;
  };
  writers: { data: WriterCost[]; page: number; perPage: number; total: number };
}
export const getJournalAnalytics = (period: AnalyticsPeriod, page: number, signal?: AbortSignal) =>
  requestJson<JournalAnalytics>(
    `/api/convolab/admin/journal-analytics?period=${period}&page=${page}`,
    { signal }
  );
export const money = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(value);
export const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
