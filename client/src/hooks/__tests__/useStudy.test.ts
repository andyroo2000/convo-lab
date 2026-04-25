import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME } from '../../lib/csrf';
import { getStudyImportStatus, startStudySession, uploadStudyImport } from '../useStudy';

describe('useStudy request helpers', () => {
  class MockXMLHttpRequest {
    static lastInstance: MockXMLHttpRequest | null = null;

    method = '';

    url = '';

    requestHeaders = new Map<string, string>();

    status = 200;

    upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };

    onerror: (() => void) | null = null;

    onabort: (() => void) | null = null;

    onload: (() => void) | null = null;

    constructor() {
      MockXMLHttpRequest.lastInstance = this;
    }

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders.set(name, value);
    }

    send() {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 1,
      } as ProgressEvent<EventTarget>);
      this.onload?.();
    }
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token`;
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  it('starts study sessions without an empty JSON body', async () => {
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
    expect(headers.get('Content-Type')).toBeNull();
    expect(requestInit.body).toBeUndefined();
  });

  it('attaches the shared CSRF token header to import uploads', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          importJob: {
            id: 'import-1',
            status: 'pending',
            sourceFilename: 'japanese.colpkg',
            deckName: '日本語',
            uploadedAt: null,
            sourceSizeBytes: null,
            importedAt: null,
            errorMessage: null,
            preview: {
              deckName: '日本語',
              noteCount: 0,
              cardCount: 0,
              reviewLogCount: 0,
              mediaReferenceCount: 0,
              skippedMediaCount: 0,
              warnings: [],
              noteTypeBreakdown: [],
            },
          },
          upload: {
            method: 'PUT',
            url: 'https://uploads.example/import-1',
            headers: {
              'Content-Type': 'application/zip',
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'import-1',
          status: 'pending',
          sourceFilename: 'japanese.colpkg',
          deckName: '日本語',
          uploadedAt: new Date('2026-04-23T00:00:00.000Z').toISOString(),
          sourceSizeBytes: 3,
          importedAt: null,
          errorMessage: null,
          preview: {
            deckName: '日本語',
            noteCount: 0,
            cardCount: 0,
            reviewLogCount: 0,
            mediaReferenceCount: 0,
            skippedMediaCount: 0,
            warnings: [],
            noteTypeBreakdown: [],
          },
        }),
      } as Response);

    await uploadStudyImport(new File(['zip'], 'japanese.colpkg'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/study/imports`, expect.any(Object));

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(MockXMLHttpRequest.lastInstance?.method).toBe('PUT');
    expect(MockXMLHttpRequest.lastInstance?.url).toBe('https://uploads.example/import-1');
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get('Content-Type')).toBe(
      'application/zip'
    );
  });

  it('does not attach mutation-only headers to study import status reads', async () => {
    await getStudyImportStatus('import-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.has(CSRF_TOKEN_HEADER_NAME)).toBe(false);
    expect(headers.has('Content-Type')).toBe(false);
  });
});
