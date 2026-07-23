import { AppError } from '../middleware/errorHandler.js';

import { fetchLearningOsServiceProxy, getLearningOsServiceProxyConfig } from './learningOsProxy.js';

const API_LABEL = 'Learning OS Tool Analytics API';
const TIMEOUT_MS = 2_000;

export type ToolAnalyticsValue = string | number | boolean | null;

export interface ToolAnalyticsEvent {
  tool: string;
  event: string;
  context: 'app' | 'public';
  mode?: 'fsrs' | 'random';
  sessionId?: string;
  properties: Record<string, ToolAnalyticsValue>;
}

export async function recordLearningOsToolAnalytics(event: ToolAnalyticsEvent): Promise<void> {
  const { apiUrl, apiToken } = getLearningOsServiceProxyConfig(API_LABEL);
  const upstreamResponse = await fetchLearningOsServiceProxy({
    upstreamUrl: new URL(`${apiUrl}/api/convolab/tools/analytics`),
    apiToken,
    method: 'POST',
    body: event,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (upstreamResponse.status !== 204) {
    throw new AppError(`${API_LABEL} request failed.`, 502);
  }
}
