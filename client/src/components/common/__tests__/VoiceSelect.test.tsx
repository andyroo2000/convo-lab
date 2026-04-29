import { render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('combobox')).toHaveValue('missing-voice');
    expect(screen.getByText('Selected voice unavailable')).toBeInTheDocument();
    expect(screen.getByText('Selected voice is not available.')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-preview')).not.toBeInTheDocument();
  });
});
