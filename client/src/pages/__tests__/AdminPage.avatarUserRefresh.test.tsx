import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockUsers,
  mockSpeakerAvatars,
  selectAvatarFile,
  mockAvatarObjectUrls,
} from './AdminPageTestHarness';

describe('AdminPage avatarUserRefresh', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('refreshes users without disturbing a replacement preview when an older upload finishes', async () => {
    let finishUpload: ((response: unknown) => void) | undefined;
    let userReads = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/avatars/user/') && url.endsWith('/upload')) {
        return new Promise((resolve) => {
          finishUpload = resolve;
        });
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpeakerAvatars) });
      }
      if (url.includes('/api/convolab/admin/users')) {
        userReads += 1;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: mockUsers }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    const objectUrls = mockAvatarObjectUrls('blob:pending-user', 'blob:new-user');
    const pendingInput = document.createElement('input');
    const newInput = document.createElement('input');
    const view = renderPage('avatars');
    const [firstUploadButton, secondUploadButton] = await screen.findAllByRole('button', {
      name: 'Upload Avatar',
    });
    const pendingCreateElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(pendingInput);
    let newCreateElementSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      fireEvent.click(firstUploadButton);
      await selectAvatarFile(
        pendingInput,
        new File(['pending'], 'pending.png', { type: 'image/png' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Crop' }));
      await waitFor(() => expect(finishUpload).toBeDefined());
      pendingCreateElementSpy.mockRestore();

      newCreateElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(newInput);
      fireEvent.click(secondUploadButton);
      await selectAvatarFile(newInput, new File(['new'], 'new.png', { type: 'image/png' }));
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:pending-user');

      await act(async () => {
        finishUpload?.({ ok: true });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText('blob:new-user')).toBeInTheDocument();
      expect(objectUrls.revokeObjectUrl).not.toHaveBeenCalledWith('blob:new-user');
      await waitFor(() => expect(userReads).toBe(2));
    } finally {
      view.unmount();
      pendingCreateElementSpy.mockRestore();
      newCreateElementSpy?.mockRestore();
      objectUrls.restore();
    }
  });
});
