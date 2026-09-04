import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminAvatarsTab from '../AdminAvatarsTab';

const adminApiMocks = vi.hoisted(() => ({
  getAdminSpeakerAvatarOriginal: vi.fn(),
  getAdminSpeakerAvatars: vi.fn(),
  recropAdminSpeakerAvatar: vi.fn(),
  uploadAdminSpeakerAvatar: vi.fn(),
}));

vi.mock('../../../lib/adminApi', () => ({
  adminApi: { userAvatarUpload: (userId: string) => `/avatars/${userId}` },
  ...adminApiMocks,
}));

vi.mock('../AvatarCropperModal', () => ({
  default: ({
    isOpen,
    onSave,
    title,
  }: {
    isOpen: boolean;
    onSave: (blob: Blob, area: { height: number; width: number; x: number; y: number }) => void;
    title: string;
  }) =>
    isOpen ? (
      <div>
        <span>{title}</span>
        <button
          type="button"
          onClick={() => onSave(new Blob(), { height: 64, width: 64, x: 4, y: 8 })}
        >
          Save crop
        </button>
      </div>
    ) : null,
}));

describe('AdminAvatarsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMocks.getAdminSpeakerAvatars.mockResolvedValue([
      {
        id: 'avatar-1',
        filename: 'ja-female-casual.jpg',
        croppedUrl: '/cropped.jpg',
        originalUrl: '/original.jpg',
        language: 'ja',
        gender: 'female',
        tone: 'casual',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    adminApiMocks.getAdminSpeakerAvatarOriginal.mockResolvedValue({
      originalUrl: '/original.jpg',
    });
    adminApiMocks.recropAdminSpeakerAvatar.mockResolvedValue({});
  });

  it('re-crops an avatar, closes the active crop session, and refreshes the list', async () => {
    const showToast = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminAvatarsTab
        users={[]}
        isUsersLoading={false}
        refreshUsers={vi.fn()}
        showToast={showToast}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Re-crop' }));
    expect(await screen.findByText('Re-crop ja-female-casual.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save crop' }));

    await waitFor(() => {
      expect(adminApiMocks.recropAdminSpeakerAvatar).toHaveBeenCalledWith(
        'ja-female-casual.jpg',
        { height: 64, width: 64, x: 4, y: 8 },
        { signal: expect.any(AbortSignal) }
      );
      expect(showToast).toHaveBeenCalledWith('Speaker avatar re-cropped successfully', 'success');
      expect(adminApiMocks.getAdminSpeakerAvatars).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('button', { name: 'Save crop' })).not.toBeInTheDocument();
  });

  it('ignores an aborted stale mutation when a newer crop save starts', async () => {
    adminApiMocks.recropAdminSpeakerAvatar
      .mockImplementationOnce(
        (_filename, _cropArea, { signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
      .mockResolvedValueOnce({});
    const showToast = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminAvatarsTab
        users={[]}
        isUsersLoading={false}
        refreshUsers={vi.fn()}
        showToast={showToast}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Re-crop' }));
    const saveButton = await screen.findByRole('button', { name: 'Save crop' });
    await user.click(saveButton);
    await waitFor(() => expect(adminApiMocks.recropAdminSpeakerAvatar).toHaveBeenCalledOnce());
    await user.click(saveButton);

    await waitFor(() => expect(adminApiMocks.getAdminSpeakerAvatars).toHaveBeenCalledTimes(2));
    expect(adminApiMocks.recropAdminSpeakerAvatar).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Speaker avatar re-cropped successfully', 'success');
  });
});
