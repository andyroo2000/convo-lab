import { isStaticMediaAvatarPath } from '../config/staticMediaRouting.js';
import { AppError } from '../middleware/errorHandler.js';

const API_LABEL = 'Learning OS Static Media API';
const REQUEST_TIMEOUT_MS = 10_000;

type StaticMediaProxyRequest = { avatarPath: string };

export async function fetchLearningOsStaticMedia(
  request: StaticMediaProxyRequest
): Promise<Response> {
  const upstreamUrl = buildLearningOsStaticMediaUrl(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // This upstream endpoint is public by design. Convo Lab applies its own
    // path validation without forwarding credentials.
    return await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
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

function buildLearningOsStaticMediaUrl(request: StaticMediaProxyRequest): URL {
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
    apiUrl.hash ||
    apiUrl.pathname !== '/'
  ) {
    throw new AppError(`${API_LABEL} is enabled but not configured.`, 503);
  }

  if (!isStaticMediaAvatarPath(request.avatarPath)) {
    throw new AppError(`${API_LABEL} received an invalid avatar path.`, 500);
  }

  const encodedAvatarPath = request.avatarPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  apiUrl.pathname = `/api/avatars/${encodedAvatarPath}`;

  return apiUrl;
}
