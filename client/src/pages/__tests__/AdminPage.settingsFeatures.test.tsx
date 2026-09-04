import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import { mockConcurrentFeatureMutations } from './AdminPageFetchMocks';

import {
  resetAdminPageMocks,
  mockSettingsReads,
  renderPage,
  mockFeatureFlags,
  mockPronunciationDictionary,
} from './AdminPageTestHarness';

describe('AdminPage settingsFeatures', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockSettingsReads();
  });

  it('should fetch and display feature flags', async () => {
    renderPage('settings');

    await waitFor(() => {
      expect(screen.getByText('Comprehensible Input Dialogues')).toBeInTheDocument();
      expect(screen.getByText('Guided Audio Course')).toBeInTheDocument();
      expect(screen.getByText('Study / Flashcards')).toBeInTheDocument();
      expect(screen.queryByText('Learning OS Study API')).not.toBeInTheDocument();
      expect(screen.queryByText('Study Review')).not.toBeInTheDocument();
    });
  });

  it('should fetch and display verb pronunciation overrides', async () => {
    renderPage('settings');

    await waitFor(() => {
      expect(screen.getByText('Verb-Kana')).toBeInTheDocument();
      expect(screen.getByDisplayValue('話す=はなす')).toBeInTheDocument();
    });
  });

  it('should toggle feature flags', async () => {
    renderPage('settings');

    const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    fireEvent.click(dialoguesToggle);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feature-flags'),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  it('rolls back a feature toggle and shows the structured mutation error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
          });
        }
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    renderPage('settings');
    const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    expect(dialoguesToggle).toBeChecked();

    fireEvent.click(dialoguesToggle);

    expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
    expect(dialoguesToggle).toBeChecked();
  });

  it('uses shared session-expiry behavior for unauthorized feature mutations', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: 'Admin session expired' }),
          });
        }
        if (url.includes('/api/feature-flags')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatureFlags) });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
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
      const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
      fireEvent.click(dialoguesToggle);

      await waitFor(() => {
        expect(expiredListener).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Admin session expired (401)')).toBeInTheDocument();
        expect(dialoguesToggle).toBeChecked();
      });
    } finally {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    }
  });

  it('keeps concurrent feature mutations isolated when responses arrive out of order', async () => {
    const resolvers: Partial<
      Record<'dialoguesEnabled' | 'scriptsEnabled', (response: unknown) => void>
    > = {};
    mockConcurrentFeatureMutations((key, resolve) => {
      resolvers[key] = resolve;
    });

    renderPage('settings');
    const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    const scriptsToggle = screen.getByLabelText('Toggle Script Player');
    fireEvent.click(dialoguesToggle);
    fireEvent.click(scriptsToggle);

    await waitFor(() => {
      expect(resolvers.dialoguesEnabled).toBeDefined();
      expect(resolvers.scriptsEnabled).toBeDefined();
      expect(dialoguesToggle).toBeDisabled();
      expect(scriptsToggle).toBeDisabled();
    });

    resolvers.scriptsEnabled?.({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...mockFeatureFlags,
          dialoguesEnabled: true,
          scriptsEnabled: false,
        }),
    });
    await waitFor(() => {
      expect(scriptsToggle).not.toBeChecked();
      expect(scriptsToggle).not.toBeDisabled();
      expect(dialoguesToggle).toBeDisabled();
    });

    resolvers.dialoguesEnabled?.({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...mockFeatureFlags,
          dialoguesEnabled: false,
          scriptsEnabled: true,
        }),
    });
    await waitFor(() => {
      expect(dialoguesToggle).not.toBeChecked();
      expect(scriptsToggle).not.toBeChecked();
      expect(dialoguesToggle).not.toBeDisabled();
    });
  });

  it('does not let a failed feature mutation overwrite a newer same-key refresh', async () => {
    let featureReadCount = 0;
    let resolvePatch: ((response: unknown) => void) | undefined;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, options?: RequestInit) => {
        if (url.includes('/sanctum/csrf-cookie')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/feature-flags') && options?.method === 'PATCH') {
          return new Promise((resolve) => {
            resolvePatch = resolve;
          });
        }
        if (url.includes('/api/feature-flags')) {
          featureReadCount += 1;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ...mockFeatureFlags,
                dialoguesEnabled: featureReadCount === 1,
              }),
          });
        }
        if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPronunciationDictionary),
          });
        }
        if (url.includes('/api/convolab/admin/users')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }
    );

    renderPage('settings');
    const dialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    expect(dialoguesToggle).toBeChecked();
    fireEvent.click(dialoguesToggle);
    await waitFor(() => expect(resolvePatch).toBeDefined());

    fireEvent.click(screen.getByRole('link', { name: 'Users' }));
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));

    const refreshedDialoguesToggle = await screen.findByLabelText('Toggle AI-Generated Dialogues');
    await waitFor(() => {
      expect(featureReadCount).toBe(2);
      expect(refreshedDialoguesToggle).not.toBeChecked();
    });

    resolvePatch?.({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ message: 'Feature settings unavailable' }),
    });

    expect(await screen.findByText('Feature settings unavailable (503)')).toBeInTheDocument();
    expect(refreshedDialoguesToggle).not.toBeChecked();
  });
});
