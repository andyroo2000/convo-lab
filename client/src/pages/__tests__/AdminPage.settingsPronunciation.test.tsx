import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';

import {
  resetAdminPageMocks,
  mockSettingsReads,
  renderPage,
  mockFeatureFlags,
  mockPronunciationDictionary,
} from './AdminPageTestHarness';

describe('AdminPage settingsPronunciation', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockSettingsReads();
  });

  it('should save verb pronunciation overrides', async () => {
    renderPage('settings');

    const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
    fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
    fireEvent.click(screen.getByText('Save Dictionary'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/convolab/admin/pronunciation-dictionaries'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"verbKana":{"書く":"かく"}'),
        })
      );
    });
  });

  it('preserves pronunciation edits and shows structured mutation errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          if (options?.method === 'PUT') {
            return Promise.resolve({
              ok: false,
              status: 503,
              json: () => Promise.resolve({ message: 'Pronunciation settings unavailable' }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    renderPage('settings');
    const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
    fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
    fireEvent.click(screen.getByText('Save Dictionary'));

    expect(await screen.findByText('Pronunciation settings unavailable (503)')).toBeInTheDocument();
    expect(verbKanaInput).toHaveValue('書く=かく');
    expect(screen.getByText('Save Dictionary')).toBeEnabled();
  });

  it('uses shared session-expiry behavior for unauthorized pronunciation mutations', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          if (options?.method === 'PUT') {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: () => Promise.resolve({ message: 'Admin session expired' }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    try {
      renderPage('settings');
      const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
      fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
      fireEvent.click(screen.getByText('Save Dictionary'));

      await waitFor(() => {
        expect(expiredListener).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
        expect(verbKanaInput).toHaveValue('書く=かく');
        expect(screen.getByText('Save Dictionary')).toBeEnabled();
      });
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    }
  });

  it('serializes saves without overwriting newer same-field edits', async () => {
    let resolveFirstPut: ((response: unknown) => void) | undefined;
    const putBodies: string[] = [];
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          if (options?.method === 'PUT') {
            putBodies.push(String(options.body));
            if (putBodies.length === 1) {
              return new Promise((resolve) => {
                resolveFirstPut = resolve;
              });
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  ...mockPronunciationDictionary,
                  verbKana: { 読む: 'よむ' },
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    renderPage('settings');
    const verbKanaInput = await screen.findByDisplayValue('話す=はなす');
    const saveButton = screen.getByText('Save Dictionary');
    const reloadButton = screen.getByText('Reload');

    fireEvent.change(verbKanaInput, { target: { value: '書く=かく' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(resolveFirstPut).toBeDefined();
      expect(screen.getByText('Saving...')).toBeDisabled();
      expect(reloadButton).toBeDisabled();
    });

    fireEvent.change(verbKanaInput, { target: { value: '読む=よむ' } });
    fireEvent.click(screen.getByText('Saving...'));
    expect(putBodies).toHaveLength(1);

    resolveFirstPut?.({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...mockPronunciationDictionary,
          verbKana: { 書く: 'かく' },
        }),
    });

    await waitFor(() => {
      expect(verbKanaInput).toHaveValue('読む=よむ');
      expect(screen.getByText('Save Dictionary')).toBeEnabled();
      expect(reloadButton).toBeEnabled();
    });

    fireEvent.click(screen.getByText('Save Dictionary'));
    await waitFor(() => expect(putBodies).toHaveLength(2));
    expect(putBodies[1]).toContain('"verbKana":{"読む":"よむ"}');
  });
});
