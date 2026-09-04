import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

import {
  resetAdminPageMocks,
  mockAvatarReads,
  renderPage,
  selectAvatarFile,
  mockAvatarObjectUrls,
} from './AdminPageTestHarness';

describe('AdminPage avatarUploadBasics', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('should fetch and display speaker avatars', async () => {
    renderPage('avatars');

    await waitFor(() => {
      expect(screen.getByText('Japanese Female - Casual')).toBeInTheDocument();
      expect(screen.getByText('Japanese Male - Polite')).toBeInTheDocument();
    });
  });

  it('should show re-crop button for existing avatars', async () => {
    renderPage('avatars');

    await waitFor(() => {
      const recropButtons = screen.getAllByText('Re-crop');
      expect(recropButtons.length).toBeGreaterThan(0);
    });
  });

  it('revokes replaced and cancelled speaker upload preview URLs exactly once', async () => {
    const objectUrls = mockAvatarObjectUrls('blob:first-speaker', 'blob:second-speaker');
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    const view = renderPage('avatars');
    const uploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
    const firstCreateElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(firstInput);
    let secondCreateElementSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      fireEvent.click(uploadButton);
      await selectAvatarFile(firstInput, new File(['first'], 'first.png', { type: 'image/png' }));
      expect(screen.getByText('blob:first-speaker')).toBeInTheDocument();
      firstCreateElementSpy.mockRestore();

      secondCreateElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(secondInput);
      fireEvent.click(uploadButton);
      await selectAvatarFile(
        secondInput,
        new File(['second'], 'second.png', { type: 'image/png' })
      );

      expect(objectUrls.createObjectUrl).toHaveBeenCalledTimes(2);
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledTimes(1);
      expect(objectUrls.revokeObjectUrl).toHaveBeenNthCalledWith(1, 'blob:first-speaker');
      expect(screen.getByText('blob:second-speaker')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel Crop' }));
      expect(objectUrls.revokeObjectUrl).toHaveBeenCalledTimes(2);
      expect(objectUrls.revokeObjectUrl).toHaveBeenNthCalledWith(2, 'blob:second-speaker');
      expect(screen.queryByTestId('avatar-cropper-modal')).not.toBeInTheDocument();
    } finally {
      view.unmount();
      firstCreateElementSpy.mockRestore();
      secondCreateElementSpy?.mockRestore();
      objectUrls.restore();
    }
  });
});
