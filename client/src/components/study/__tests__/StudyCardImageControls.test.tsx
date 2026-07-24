import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import StudyCardImageControls from '../StudyCardImageControls';

describe('StudyCardImageControls', () => {
  it('edits prompt text and placement without requiring an existing image', async () => {
    const onImagePromptChange = vi.fn();
    const onImagePlacementChange = vi.fn();

    render(
      <StudyCardImageControls
        altText="Generated card image"
        imagePlacement="prompt"
        imagePrompt="A quiet office in Tokyo."
        imagePromptId="image-prompt"
        imagePromptLabel="Image prompt"
        isRegenerating={false}
        onImagePlacementChange={onImagePlacementChange}
        onImagePromptChange={onImagePromptChange}
        onRegenerate={vi.fn()}
        previewUrl={null}
        regenerateLabel="Generate image"
        title="Card image"
      />
    );

    await userEvent.type(screen.getByLabelText('Image prompt'), '.');
    await userEvent.selectOptions(screen.getByLabelText('Image placement'), 'both');

    expect(onImagePromptChange).toHaveBeenLastCalledWith('A quiet office in Tokyo..');
    expect(onImagePlacementChange).toHaveBeenCalledWith('both');
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeEnabled();
  });

  it('keeps the existing preview visible while the prompt is edited', async () => {
    render(
      <StudyCardImageControls
        altText="Generated card image"
        imagePlacement="answer"
        imagePrompt="A cloudy train platform."
        imagePromptId="image-prompt"
        imagePromptLabel="Image prompt"
        isRegenerating={false}
        onImagePlacementChange={vi.fn()}
        onImagePromptChange={vi.fn()}
        onRegenerate={vi.fn()}
        previewUrl="http://localhost:3001/api/study/media/image-1"
        regenerateLabel="Generate image"
        title="Card image"
      />
    );

    await userEvent.clear(screen.getByLabelText('Image prompt'));
    await userEvent.type(screen.getByLabelText('Image prompt'), 'A different prompt.');

    expect(screen.getByAltText('Generated card image')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/image-1'
    );
  });

  it('disables image generation when placement is none or the prompt is blank', () => {
    const { rerender } = render(
      <StudyCardImageControls
        altText="Generated card image"
        imagePlacement="none"
        imagePrompt="A clear image."
        imagePromptId="image-prompt"
        imagePromptLabel="Image prompt"
        isRegenerating={false}
        onImagePlacementChange={vi.fn()}
        onImagePromptChange={vi.fn()}
        onRegenerate={vi.fn()}
        previewUrl={null}
        regenerateLabel="Generate image"
        title="Card image"
      />
    );

    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();

    rerender(
      <StudyCardImageControls
        altText="Generated card image"
        imagePlacement="prompt"
        imagePrompt="   "
        imagePromptId="image-prompt"
        imagePromptLabel="Image prompt"
        isRegenerating={false}
        onImagePlacementChange={vi.fn()}
        onImagePromptChange={vi.fn()}
        onRegenerate={vi.fn()}
        previewUrl={null}
        regenerateLabel="Generate image"
        title="Card image"
      />
    );

    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });
});
