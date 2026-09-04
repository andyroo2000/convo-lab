import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockSpeakerAvatars,
  selectAvatarFile,
  mockAvatarObjectUrls,
} from './AdminPageTestHarness';

describe('AdminPage avatarSpeakerLifecycle', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('revokes speaker upload previews on tab changes and page unmount', async () => {
    const objectUrls = mockAvatarObjectUrls('blob:tab-change', 'blob:page-unmount');
    const tabInput = document.createElement('input');
    const unmountInput = document.createElement('input');
    const view = renderPage('avatars');
    const firstUploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
    const tabCreateElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(tabInput);
    let unmountCreateElementSpy: ReturnType<typeof vi.spyOn> | undefined;
    let secondView: ReturnType<typeof render> | undefined;

    try {
      fireEvent.click(firstUploadButton);
      await selectAvatarFile(tabInput, new File(['tab'], 'tab.png', { type: 'image/png' }));
      fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
      await waitFor(() =>
        expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:tab-change')
      );
      view.unmount();
      tabCreateElementSpy.mockRestore();

      secondView = renderPage('avatars');
      const secondUploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
      unmountCreateElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValueOnce(unmountInput);
      fireEvent.click(secondUploadButton);
      await selectAvatarFile(
        unmountInput,
        new File(['unmount'], 'unmount.png', { type: 'image/png' })
      );
      secondView.unmount();

      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledTimes(2);
      expect(objectUrls.revokeObjectUrl).toHaveBeenNthCalledWith(2, 'blob:page-unmount');
    } finally {
      view.unmount();
      secondView?.unmount();
      tabCreateElementSpy.mockRestore();
      unmountCreateElementSpy?.mockRestore();
      objectUrls.restore();
    }
  });

  it('keeps a replacement preview alive when an older upload finishes late', async () => {
    let finishUpload: ((response: unknown) => void) | undefined;
    let speakerAvatarReads = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/sanctum/csrf-cookie')) return Promise.resolve({ ok: true });
      if (url.endsWith('/upload')) {
        return new Promise((resolve) => {
          finishUpload = resolve;
        });
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        speakerAvatarReads += 1;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpeakerAvatars) });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    const objectUrls = mockAvatarObjectUrls('blob:pending-speaker', 'blob:new-speaker');
    const pendingInput = document.createElement('input');
    const newInput = document.createElement('input');
    const view = renderPage('avatars');
    const uploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
    const pendingCreateElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(pendingInput);
    let newCreateElementSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      fireEvent.click(uploadButton);
      await selectAvatarFile(
        pendingInput,
        new File(['pending'], 'pending.png', { type: 'image/png' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Crop' }));
      await waitFor(() => expect(finishUpload).toBeDefined());
      pendingCreateElementSpy.mockRestore();

      newCreateElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(newInput);
      fireEvent.click(uploadButton);
      await selectAvatarFile(newInput, new File(['new'], 'new.png', { type: 'image/png' }));
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:pending-speaker');

      await act(async () => {
        finishUpload?.({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              message: 'Updated',
              filename: 'ja-female-casual.jpg',
              croppedUrl: 'https://example.com/cropped.jpg',
              originalUrl: 'https://example.com/original.jpg',
            }),
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText('blob:new-speaker')).toBeInTheDocument();
      expect(objectUrls.revokeObjectUrl).not.toHaveBeenCalledWith('blob:new-speaker');
      await waitFor(() => expect(speakerAvatarReads).toBe(2));
    } finally {
      view.unmount();
      pendingCreateElementSpy.mockRestore();
      newCreateElementSpy?.mockRestore();
      objectUrls.restore();
    }
  });
});
