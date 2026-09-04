import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  mockSpeakerAvatars,
  selectAvatarFile,
  mockAvatarObjectUrls,
} from './AdminPageTestHarness';

describe('AdminPage avatarSpeakerSave', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('revokes the speaker upload preview after a successful save', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/sanctum/csrf-cookie')) return Promise.resolve({ ok: true });
      if (url.endsWith('/upload')) {
        return Promise.resolve({
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
      }
      if (url.includes('/api/convolab/admin/avatars/speakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpeakerAvatars) });
      }
      if (url.includes('/api/convolab/admin/users')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [] }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    const objectUrls = mockAvatarObjectUrls('blob:saved-speaker');
    const fileInput = document.createElement('input');
    const view = renderPage('avatars');
    const uploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(fileInput);

    try {
      fireEvent.click(uploadButton);
      await selectAvatarFile(
        fileInput,
        new File(['speaker'], 'speaker.png', { type: 'image/png' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Crop' }));

      expect(await screen.findByText('Speaker avatar updated successfully')).toBeInTheDocument();
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledOnce();
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:saved-speaker');
    } finally {
      view.unmount();
      createElementSpy.mockRestore();
      objectUrls.restore();
    }
  });
});
