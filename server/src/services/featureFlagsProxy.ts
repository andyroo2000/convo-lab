import { AppError } from '../middleware/errorHandler.js';

import { fetchLearningOsProxy, resolveLearningOsServiceProxyContext } from './learningOsProxy.js';

const API_LABEL = 'Learning OS Feature Flags API';
const TIMEOUT_MS = 10_000;
const ISO_MILLISECOND_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface ClientFeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  scriptsEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
  updatedAt: string;
}

export type ClientFeatureFlagsPatch = Partial<
  Pick<
    ClientFeatureFlags,
    'dialoguesEnabled' | 'scriptsEnabled' | 'audioCourseEnabled' | 'flashcardsEnabled'
  >
>;

const PATCH_KEYS = [
  'dialoguesEnabled',
  'scriptsEnabled',
  'audioCourseEnabled',
  'flashcardsEnabled',
] as const;

export function parseClientFeatureFlagsPatch(value: unknown): ClientFeatureFlagsPatch {
  const payload =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const patch: ClientFeatureFlagsPatch = {};

  for (const key of PATCH_KEYS) {
    const flag = payload[key];
    if (flag !== undefined && typeof flag !== 'boolean') {
      throw new AppError(`${key} must be a boolean`, 400);
    }
    if (typeof flag === 'boolean') {
      patch[key] = flag;
    }
  }

  return patch;
}

export async function getLearningOsFeatureFlags(): Promise<ClientFeatureFlags> {
  return requestLearningOsFeatureFlags('GET');
}

export async function updateLearningOsFeatureFlags(
  patch: ClientFeatureFlagsPatch
): Promise<ClientFeatureFlags> {
  return requestLearningOsFeatureFlags('PATCH', patch);
}

async function requestLearningOsFeatureFlags(
  method: 'GET' | 'PATCH',
  body?: ClientFeatureFlagsPatch
): Promise<ClientFeatureFlags> {
  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/feature-flags`),
    apiToken: config.apiToken,
    user,
    method,
    body,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (!upstreamResponse.ok) {
    const statusCode =
      upstreamResponse.status === 401 ||
      upstreamResponse.status === 403 ||
      upstreamResponse.status >= 500
        ? 502
        : upstreamResponse.status;
    throw new AppError(`${API_LABEL} request failed.`, statusCode);
  }

  let upstreamJson: unknown;
  try {
    upstreamJson = JSON.parse(await upstreamResponse.text());
  } catch {
    throw new AppError(`${API_LABEL} returned invalid JSON.`, 502);
  }

  return adaptFeatureFlagsResponse(upstreamJson);
}

function adaptFeatureFlagsResponse(value: unknown): ClientFeatureFlags {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(`${API_LABEL} returned an invalid response.`, 502);
  }

  const flags = value as Record<string, unknown>;
  if (
    typeof flags.id !== 'string' ||
    flags.id.trim().length < 1 ||
    flags.id.length > 255 ||
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(flags.id) ||
    typeof flags.dialoguesEnabled !== 'boolean' ||
    typeof flags.scriptsEnabled !== 'boolean' ||
    typeof flags.audioCourseEnabled !== 'boolean' ||
    typeof flags.flashcardsEnabled !== 'boolean' ||
    typeof flags.updatedAt !== 'string' ||
    !ISO_MILLISECOND_TIMESTAMP.test(flags.updatedAt) ||
    Number.isNaN(Date.parse(flags.updatedAt))
  ) {
    throw new AppError(`${API_LABEL} returned an invalid response.`, 502);
  }

  return {
    id: flags.id,
    dialoguesEnabled: flags.dialoguesEnabled,
    scriptsEnabled: flags.scriptsEnabled,
    audioCourseEnabled: flags.audioCourseEnabled,
    flashcardsEnabled: flags.flashcardsEnabled,
    updatedAt: flags.updatedAt,
  };
}
