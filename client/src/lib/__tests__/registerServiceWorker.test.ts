import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerSWMock, updateServiceWorkerMock } = vi.hoisted(() => ({
  registerSWMock: vi.fn(),
  updateServiceWorkerMock: vi.fn(),
}));

vi.mock('../pwaRegister', () => ({
  default: registerSWMock,
}));

describe('registerConvoLabServiceWorker', () => {
  beforeEach(() => {
    registerSWMock.mockReset();
    updateServiceWorkerMock.mockReset();
    updateServiceWorkerMock.mockResolvedValue(undefined);
    registerSWMock.mockReturnValue(updateServiceWorkerMock);
  });

  it('auto-applies waiting service worker updates', async () => {
    const { default: registerConvoLabServiceWorker } = await import('../registerServiceWorker');

    registerConvoLabServiceWorker();

    expect(registerSWMock).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh: expect.any(Function),
      })
    );

    const options = registerSWMock.mock.calls[0]?.[0];
    options.onNeedRefresh();

    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
  });
});
