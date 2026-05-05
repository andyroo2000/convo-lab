import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import VoiceSelect from '../VoiceSelect';

vi.mock('../VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => (
    <div data-testid="voice-preview">Preview {voiceId}</div>
  ),
}));

describe('VoiceSelect', () => {
  it('shows a clear unavailable state when the selected voice is not in the list', () => {
    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="missing-voice"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Selected voice unavailable');
    expect(screen.getByText('Selected voice unavailable')).toBeInTheDocument();
    expect(screen.getByText('Selected voice is not available.')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-preview')).not.toBeInTheDocument();
  });

  it('hides legacy voices when they are not selected', async () => {
    const user = userEvent.setup();

    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="ja-JP-Wavenet-C"
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: /Shohei/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ichiro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Nanami/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Naoki/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Daichi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Takumi/ })).not.toBeInTheDocument();
  });

  it('preserves a selected legacy voice in the dropdown', async () => {
    const user = userEvent.setup();

    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="ja-JP-Neural2-D"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Daichi');
    expect(screen.getByRole('combobox')).toHaveTextContent('Legacy');
    expect(screen.getByTestId('voice-preview')).toHaveTextContent('ja-JP-Neural2-D');

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: /Daichi/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ichiro/ })).not.toBeInTheDocument();
  });

  it('calls onChange when selecting a visible voice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="ja-JP-Wavenet-C"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Sato/ }));

    expect(onChange).toHaveBeenCalledWith('fishaudio:875668667eb94c20b09856b971d9ca2f');
  });

  it('supports keyboard navigation for visible voices', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="ja-JP-Wavenet-C"
        onChange={onChange}
      />
    );

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('fishaudio:0dff3f6860294829b98f8c4501b2cf25');
  });

  it('shows signed speaker avatar endpoint images for the selected voice and dropdown options', async () => {
    const user = userEvent.setup();
    render(
      <VoiceSelect
        id="voice"
        label="Voice"
        language="ja"
        value="ja-JP-Wavenet-C"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('voice-avatar-image-ja-JP-Wavenet-C')).toHaveAttribute(
      'src',
      '/api/avatars/voices/ja-shohei.jpg'
    );

    await user.click(screen.getByRole('combobox'));

    expect(
      screen.getByTestId('voice-avatar-image-fishaudio:875668667eb94c20b09856b971d9ca2f')
    ).toHaveAttribute('src', '/api/avatars/voices/ja-sato.jpg');
  });
});
