import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
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
    document.cookie = 'study_csrf=test-study-csrf';
  });

  afterEach(() => {
    document.cookie = 'study_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.unstubAllGlobals();
  });

  it('attaches the study CSRF token header to JSON study mutations', async () => {
    await startStudySession();

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/study/session/start`,
      expect.any(Object)
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get('X-Study-CSRF-Token')).toBe('test-study-csrf');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('attaches the study CSRF token header to import uploads', async () => {
    await uploadStudyImport(new File(['zip'], 'japanese.colpkg'));

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/imports`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get('X-Study-CSRF-Token')).toBe('test-study-csrf');
  });
});
