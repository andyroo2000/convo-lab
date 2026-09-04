import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockUsers,
  mockSpeakerAvatars,
  selectAvatarFile,
  mockAvatarObjectUrls,
} from './AdminPageTestHarness';

describe('AdminPage avatarUserSave', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('revokes user avatar upload previews after successful saves', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/avatars/user/') && url.endsWith('/upload')) {
        return Promise.resolve({ ok: true });
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpeakerAvatars) });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: mockUsers }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    const objectUrls = mockAvatarObjectUrls('blob:saved-user');
    const fileInput = document.createElement('input');
    const view = renderPage('avatars');
    const uploadButton = (await screen.findAllByRole('button', { name: 'Upload Avatar' }))[0];
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(fileInput);

    try {
      fireEvent.click(uploadButton);
      await selectAvatarFile(fileInput, new File(['user'], 'user.png', { type: 'image/png' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Crop' }));

      expect(await screen.findByText('User avatar updated successfully')).toBeInTheDocument();
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledOnce();
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:saved-user');
    } finally {
      view.unmount();
      createElementSpy.mockRestore();
      objectUrls.restore();
    }
  });
});
