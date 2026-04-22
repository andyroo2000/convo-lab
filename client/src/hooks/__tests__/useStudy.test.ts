import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME } from '../../lib/csrf';
import { startStudySession, uploadStudyImport } from '../useStudy';

describe('useStudy request helpers', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token`;
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  it('attaches the shared CSRF token header to JSON study mutations', async () => {
    await startStudySession();

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/session/start`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('attaches the shared CSRF token header to import uploads', async () => {
    await uploadStudyImport(new File(['zip'], 'japanese.colpkg'));

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/imports`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
  });
});
