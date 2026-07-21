import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export interface LearningOsProxyConfig {
  apiUrl: string;
  apiToken: string;
}

export interface LearningOsProxyUser {
  id: string;
  email: string;
  role: string;
}

interface LearningOsProxyRequest {
  upstreamUrl: URL;
  apiToken: string;
  user: LearningOsProxyUser;
  method: string;
  body?: unknown;
  additionalHeaders?: Readonly<Record<string, string>>;
  timeoutMs: number;
  timeoutMessage: string;
  networkErrorMessage?: string;
}

export function getLearningOsProxyConfig(apiLabel: string): LearningOsProxyConfig & {
  proxyUserEmail: string;
} {
  const apiUrl = process.env.LEARNING_OS_API_URL?.trim();
  const apiToken = process.env.LEARNING_OS_API_TOKEN?.trim();
  const proxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL?.trim().toLowerCase();

  if (!apiUrl || !apiToken || !proxyUserEmail) {
    throw new AppError(`${apiLabel} is enabled but not configured.`, 503);
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new AppError(`${apiLabel} is enabled but not configured.`, 503);
  }

  const plaintextHosts = new Set(['learning-os', 'localhost', '127.0.0.1', '[::1]']);
  const usesAllowedScheme =
    parsedApiUrl.protocol === 'https:' ||
    (parsedApiUrl.protocol === 'http:' && plaintextHosts.has(parsedApiUrl.hostname));
  if (
    !usesAllowedScheme ||
    parsedApiUrl.username ||
    parsedApiUrl.password ||
    parsedApiUrl.search ||
    parsedApiUrl.hash ||
    parsedApiUrl.pathname !== '/'
  ) {
    throw new AppError(`${apiLabel} is enabled but not configured.`, 503);
  }

  return {
    apiUrl: parsedApiUrl.origin,
    apiToken,
    proxyUserEmail,
  };
}

export async function resolveLearningOsProxyContext(
  userId: string,
  apiLabel: string
): Promise<{ config: LearningOsProxyConfig; user: LearningOsProxyUser }> {
  const { config, proxyUserEmail, user } = await resolveLearningOsUserContext(userId, apiLabel);

  if (user.email.trim().toLowerCase() !== proxyUserEmail) {
    throw new AppError(`${apiLabel} is not enabled for this account.`, 403);
  }

  return { config, user };
}

export async function resolveLearningOsUserProxyContext(
  userId: string,
  apiLabel: string
): Promise<{ config: LearningOsProxyConfig; user: LearningOsProxyUser }> {
  const { config, user } = await resolveLearningOsUserContext(userId, apiLabel);

  return { config, user };
}

async function resolveLearningOsUserContext(
  userId: string,
  apiLabel: string
): Promise<{
  config: LearningOsProxyConfig;
  proxyUserEmail: string;
  user: LearningOsProxyUser;
}> {
  const { apiUrl, apiToken, proxyUserEmail } = getLearningOsProxyConfig(apiLabel);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return { config: { apiUrl, apiToken }, proxyUserEmail, user };
}

export async function resolveLearningOsServiceProxyContext(
  apiLabel: string
): Promise<{ config: LearningOsProxyConfig; user: LearningOsProxyUser }> {
  const { proxyUserEmail, ...config } = getLearningOsProxyConfig(apiLabel);
  const user = await prisma.user.findUnique({
    where: { email: proxyUserEmail },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError(`${apiLabel} proxy account is unavailable.`, 503);
  }

  return { config, user };
}

export function learningOsProxyHeaders(
  apiToken: string,
  user: LearningOsProxyUser,
  additionalHeaders: Readonly<Record<string, string>> = {}
): Record<string, string> {
  return {
    ...additionalHeaders,
    Accept: additionalHeaders.Accept ?? 'application/json',
    Authorization: `Bearer ${apiToken}`,
    'X-Convo-Lab-User-Id': user.id,
    'X-Convo-Lab-User-Email': user.email,
    'X-Convo-Lab-User-Role': user.role,
  };
}

export async function fetchLearningOsProxy({
  upstreamUrl,
  apiToken,
  user,
  method,
  body,
  additionalHeaders,
  timeoutMs,
  timeoutMessage,
  networkErrorMessage,
}: LearningOsProxyRequest): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = learningOsProxyHeaders(apiToken, user, additionalHeaders);

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    return await fetch(upstreamUrl, {
      method,
      signal: controller.signal,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError(timeoutMessage, 504);
    }
    if (networkErrorMessage) {
      throw new AppError(networkErrorMessage, 502);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
