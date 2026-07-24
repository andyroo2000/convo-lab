import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import StudyCandidatePreviewAudio from '../StudyCandidatePreviewAudio';

vi.mock('../StudyAudioPlayer', () => ({
  default: ({ label, url }: { label: string; url: string }) => (
    <button type="button" data-url={url}>
      {label}
    </button>
  ),
}));

describe('StudyCandidatePreviewAudio', () => {
  it('shows a single regenerating state when no preview audio exists yet', () => {
    render(
      <StudyCandidatePreviewAudio
        isRegenerating
        label="Play preview"
        onRegenerate={vi.fn()}
        previewUrl={null}
        regenerateError={null}
        regenerateLabel="Regenerating..."
        staleLabel="Audio will be generated when you add this card."
        title="Answer audio preview"
      />
    );

    expect(screen.getByRole('status', { name: 'Regenerating...' })).toBeInTheDocument();
    expect(
      screen.queryByText('Audio will be generated when you add this card.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerating...' })).not.toBeInTheDocument();
  });

  it('keeps the audio player visible while regenerating an existing preview', () => {
    render(
      <StudyCandidatePreviewAudio
        isRegenerating
        label="Play preview"
        onRegenerate={vi.fn()}
        previewUrl="/api/study/media/audio-1"
        regenerateError={null}
        regenerateLabel="Regenerating..."
        staleLabel="Audio will be generated when you add this card."
        title="Answer audio preview"
      />
    );

    expect(screen.getByRole('button', { name: 'Play preview' })).toHaveAttribute(
      'data-url',
      '/api/study/media/audio-1'
    );
    expect(screen.getByRole('status', { name: 'Regenerating...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerating...' })).toBeDisabled();
  });
});
