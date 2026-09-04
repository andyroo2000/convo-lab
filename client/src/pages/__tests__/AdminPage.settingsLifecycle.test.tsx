import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import { mockPendingSettingsMutations } from './AdminPageFetchMocks';

import {
  resetAdminPageMocks,
  mockSettingsReads,
  renderPage,
  mockFeatureFlags,
  mockPronunciationDictionary,
} from './AdminPageTestHarness';

describe('AdminPage settingsLifecycle', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockSettingsReads();
  });

  it('cancels both concurrent settings reads when the page unmounts', async () => {
    let featureFlagsSignal: AbortSignal | undefined;
    let pronunciationSignal: AbortSignal | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/api/feature-flags')) {
          return new Promise((_resolve, reject) => {
            featureFlagsSignal = options?.signal ?? undefined;
            featureFlagsSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return new Promise((_resolve, reject) => {
            pronunciationSignal = options?.signal ?? undefined;
            pronunciationSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    const view = renderPage('settings');
    await waitFor(() => {
      expect(featureFlagsSignal).toBeDefined();
      expect(pronunciationSignal).toBeDefined();
    });
    expect(featureFlagsSignal).not.toBe(pronunciationSignal);

    view.unmount();

    expect(featureFlagsSignal?.aborted).toBe(true);
    expect(pronunciationSignal?.aborted).toBe(true);
  });

  it('aborts both settings mutations when the page unmounts', async () => {
    let featureMutationOptions: RequestInit | undefined;
    let pronunciationMutationOptions: RequestInit | undefined;
    mockPendingSettingsMutations((kind, init) => {
      if (kind === 'feature') featureMutationOptions = init;
      else pronunciationMutationOptions = init;
    });

    const view = renderPage('settings');
    const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    await screen.findByDisplayValue('話す=はなす');
    fireEvent.click(dialoguesToggle);
    fireEvent.click(screen.getByText('Save Dictionary'));

    await waitFor(() => {
      expect(featureMutationOptions).toBeDefined();
      expect(pronunciationMutationOptions).toBeDefined();
    });
    expect(featureMutationOptions?.signal).toBeDefined();
    expect(pronunciationMutationOptions?.signal).toBeDefined();

    view.unmount();

    expect(featureMutationOptions?.signal?.aborted).toBe(true);
    expect(pronunciationMutationOptions?.signal?.aborted).toBe(true);
  });

  it('shows structured errors for failed feature-flag reads', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/feature-flags')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
        });
      }
      if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPronunciationDictionary),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('settings');

    expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('話す=はなす')).toBeInTheDocument();
  });

  it('shows structured errors for failed pronunciation-dictionary reads', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/feature-flags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFeatureFlags),
        });
      }
      if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ message: 'Pronunciation settings unavailable' }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderPage('settings');

    expect(await screen.findByText('Pronunciation settings unavailable (503)')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle AI-Generated Dialogues')).toBeInTheDocument();
  });

  it('uses shared session-expiry behavior for unauthorized settings reads', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/feature-flags')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Admin session expired' }),
        });
      }
      if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPronunciationDictionary),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    try {
      renderPage('settings');

      await waitFor(() => {
        expect(expiredListener).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
      });
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    }
  });
});
