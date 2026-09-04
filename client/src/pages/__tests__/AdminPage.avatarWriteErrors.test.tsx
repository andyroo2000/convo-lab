import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  mockPendingRecrop,
  mockRecropFailure,
  mockSpeakerUploadFailure,
} from './AdminPageFetchMocks';

import { resetAdminPageMocks, mockAvatarReads, renderPage } from './AdminPageTestHarness';

describe('AdminPage avatarWriteErrors', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    mockAvatarReads();
  });

  it('preserves structured speaker re-crop errors', async () => {
    mockRecropFailure(409, 'Speaker avatar must be uploaded before it can be re-cropped');

    renderPage('avatars');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Re-crop' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));

    expect(
      await screen.findByText('Speaker avatar must be uploaded before it can be re-cropped (409)')
    ).toBeInTheDocument();
  });

  it('cancels a pending speaker re-crop mutation when the page unmounts', async () => {
    let recropSignal: AbortSignal | undefined;
    mockPendingRecrop((signal) => {
      recropSignal = signal;
    });

    const view = renderPage('avatars');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Re-crop' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));
    await waitFor(() => expect(recropSignal).toBeDefined());
    expect(recropSignal?.aborted).toBe(false);

    view.unmount();

    expect(recropSignal?.aborted).toBe(true);
  });

  it('preserves structured speaker upload errors through the multipart client', async () => {
    let uploadInit: RequestInit | undefined;
    mockSpeakerUploadFailure(413, 'Speaker avatar image is too large', (init) => {
      uploadInit = init;
    });

    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:speaker-avatar'),
    });
    renderPage('avatars');
    const uploadButton = (await screen.findAllByRole('button', { name: 'Upload New' }))[0];
    const fileInput = document.createElement('input');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(fileInput);

    try {
      fireEvent.click(uploadButton);
      const image = new File(['image-bytes'], 'source.png', { type: 'image/png' });
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [image] });
      await act(async () => {
        fileInput.onchange?.({ target: fileInput } as unknown as Event);
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Save Crop' }));

      expect(
        await screen.findByText('Speaker avatar image is too large (413)')
      ).toBeInTheDocument();
      expect(uploadInit?.signal).toBeDefined();
      expect(uploadInit?.body).toBeInstanceOf(FormData);
      expect(new Headers(uploadInit?.headers).get('Content-Type')).toBeNull();
    } finally {
      createElementSpy.mockRestore();
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
    }
  });
});
