import { AppError } from '../middleware/errorHandler.js';

const API_LABEL = 'Learning OS Static Media API';
const REQUEST_TIMEOUT_MS = 10_000;

interface StaticMediaProxyRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

export async function fetchLearningOsStaticMedia({
  method,
  path,
  body,
}: StaticMediaProxyRequest): Promise<Response> {
  const upstreamUrl = buildLearningOsStaticMediaUrl(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(upstreamUrl, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AppError(`${API_LABEL} request timed out.`, 504);
    }

    throw new AppError(`${API_LABEL} is unavailable.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function buildLearningOsStaticMediaUrl(path: string): URL {
  const configuredUrl = process.env.LEARNING_OS_API_URL?.trim();
  if (!configuredUrl) {
    throw new AppError(`${API_LABEL} is enabled but not configured.`, 503);
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredUrl);
  } catch {
    throw new AppError(`${API_LABEL} is enabled but not configured.`, 503);
  }

  if (
    !['http:', 'https:'].includes(apiUrl.protocol) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash
  ) {
    throw new AppError(`${API_LABEL} is enabled but not configured.`, 503);
  }

  return new URL(path, `${apiUrl.href.replace(/\/+$/, '')}/`);
}
