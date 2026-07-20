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

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiToken,
    proxyUserEmail,
  };
}

export async function resolveLearningOsProxyContext(
  userId: string,
  apiLabel: string
): Promise<{ config: LearningOsProxyConfig; user: LearningOsProxyUser }> {
  const { proxyUserEmail, ...config } = getLearningOsProxyConfig(apiLabel);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.email.trim().toLowerCase() !== proxyUserEmail) {
    throw new AppError(`${apiLabel} is not enabled for this account.`, 403);
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

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
