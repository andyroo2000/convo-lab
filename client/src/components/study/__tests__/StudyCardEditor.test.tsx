import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyCardEditor from '../StudyCardEditor';

vi.mock('../../common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

const audioPrompt = {
  filename: 'prompt.mp3',
  url: 'https://example.com/prompt.mp3',
  mediaKind: 'audio' as const,
  source: 'generated' as const,
};

const audioRecognitionCard = {
  id: 'card-audio',
  noteId: 'note-audio',
  cardType: 'recognition' as const,
  prompt: {
    cueAudio: audioPrompt,
  },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
    answerAudioVoiceId: 'fishaudio:79a125e8a44f43d5a0cbef50b4f86f7a',
  },
  state: {
    dueAt: null,
    queueState: 'new' as const,
    scheduler: null,
    source: {},
  },
  answerAudioSource: 'missing' as const,
  createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
};

const imageRef = {
  id: 'image-1',
  filename: 'piano.webp',
  url: 'https://example.com/piano.webp',
  mediaKind: 'image' as const,
  source: 'generated' as const,
};

describe('StudyCardEditor', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('saves audio-recognition cards without requiring or adding prompt text', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<StudyCardEditor card={audioRecognitionCard} onCancel={vi.fn()} onSave={onSave} />);

    expect(screen.queryByLabelText('Prompt text')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        prompt: expect.objectContaining({
          cueAudio: audioPrompt,
          cueText: null,
        }),
        answer: expect.objectContaining({
          expression: '会社',
        }),
      });
    });
  });

  it('explicitly moves an audio-recognition card image between prompt and answer placement', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const card = {
      ...audioRecognitionCard,
      prompt: {
        ...audioRecognitionCard.prompt,
        cueImage: imageRef,
      },
    };

    render(<StudyCardEditor card={card} onCancel={vi.fn()} onSave={onSave} />);

    await userEvent.selectOptions(screen.getByLabelText('Image placement'), 'answer');
    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        prompt: expect.objectContaining({
          cueAudio: audioPrompt,
          cueImage: null,
          cueText: null,
        }),
        answer: expect.objectContaining({
          answerImage: imageRef,
          expression: '会社',
        }),
      });
    });
  });
});
