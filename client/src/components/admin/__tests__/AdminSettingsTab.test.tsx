import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSettingsTab from '../AdminSettingsTab';

const adminApiMocks = vi.hoisted(() => ({
  getAdminFeatureFlags: vi.fn(),
  getAdminPronunciationDictionary: vi.fn(),
  updateAdminFeatureFlag: vi.fn(),
  updateAdminPronunciationDictionary: vi.fn(),
}));

vi.mock('../../../lib/adminApi', () => adminApiMocks);

const featureFlags = {
  id: 'flags',
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const pronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  verbKana: { 話す: 'はなす' },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMocks.getAdminFeatureFlags.mockResolvedValue(featureFlags);
    adminApiMocks.getAdminPronunciationDictionary.mockResolvedValue(pronunciationDictionary);
    adminApiMocks.updateAdminFeatureFlag.mockResolvedValue({
      ...featureFlags,
      scriptsEnabled: false,
    });
    adminApiMocks.updateAdminPronunciationDictionary.mockResolvedValue(pronunciationDictionary);
  });

  it('updates a feature flag through the optimistic mutation flow', async () => {
    const showToast = vi.fn();
    const user = userEvent.setup();
    render(<AdminSettingsTab showToast={showToast} />);

    const toggle = await screen.findByRole('checkbox', { name: 'Toggle Script Player' });
    await user.click(toggle);

    await waitFor(() =>
      expect(adminApiMocks.updateAdminFeatureFlag).toHaveBeenCalledWith('scriptsEnabled', false, {
        signal: expect.any(AbortSignal),
      })
    );
    expect(showToast).toHaveBeenCalledWith('Settings updated successfully', 'success');
  });

  it('parses and saves all pronunciation dictionary fields', async () => {
    const showToast = vi.fn();
    const user = userEvent.setup();
    render(<AdminSettingsTab showToast={showToast} />);

    const textboxes = await screen.findAllByRole('textbox');
    await user.clear(textboxes[0]);
    await user.type(textboxes[0], '箸');
    await user.clear(textboxes[1]);
    await user.type(textboxes[1], '東京=とうきょう');
    await user.clear(textboxes[2]);
    await user.type(textboxes[2], '書く=かく');
    await user.click(screen.getByRole('button', { name: 'Save Dictionary' }));

    await waitFor(() =>
      expect(adminApiMocks.updateAdminPronunciationDictionary).toHaveBeenCalledWith(
        {
          keepKanji: ['箸'],
          forceKana: { 東京: 'とうきょう' },
          verbKana: { 書く: 'かく' },
        },
        { signal: expect.any(AbortSignal) }
      )
    );
    expect(showToast).toHaveBeenCalledWith('Pronunciation dictionary updated', 'success');
  });
});
