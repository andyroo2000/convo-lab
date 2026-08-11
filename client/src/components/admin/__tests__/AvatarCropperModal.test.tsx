import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AvatarCropperModal from '../AvatarCropperModal';

vi.mock('react-easy-crop', () => ({
  default: ({ image }: { image: string }) => <div data-testid="cropper">{image}</div>,
}));

describe('AvatarCropperModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revokes its fetched image blob URL when the modal closes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['avatar'], { type: 'image/png' })),
    } as Response);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cropper-image');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const view = render(
      <AvatarCropperModal
        isOpen
        imageUrl="https://example.com/avatar.png"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(createObjectUrl).toHaveBeenCalledOnce());
    view.rerender(
      <AvatarCropperModal
        isOpen={false}
        imageUrl="https://example.com/avatar.png"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cropper-image');
  });

  it('revokes a blob URL created after the modal already closed', async () => {
    let finishFetch: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFetch = resolve;
        })
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late-cropper-image');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const view = render(
      <AvatarCropperModal
        isOpen
        imageUrl="https://example.com/avatar.png"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(finishFetch).toBeDefined());
    view.rerender(
      <AvatarCropperModal
        isOpen={false}
        imageUrl="https://example.com/avatar.png"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    finishFetch?.({
      ok: true,
      blob: () => Promise.resolve(new Blob(['avatar'], { type: 'image/png' })),
    } as Response);

    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:late-cropper-image'));
  });
});
