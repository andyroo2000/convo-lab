import type { StudyCardSummary, StudyMediaRef } from '@languageflow/shared/src/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyCardEditor from '../StudyCardEditor';

vi.mock('../../common/VoicePreview', () => ({ default: () => null }));

const audio = (id: string): StudyMediaRef => ({
  id,
  filename: `${id}.mp3`,
  url: `/api/study/media/${id}`,
  mediaKind: 'audio',
  source: 'generated',
});

const originalAudio = audio('original');
const regeneratedAudio = audio('regenerated');
const latestAudio = audio('latest');

const card: StudyCardSummary = {
  id: 'card-audio',
  noteId: 'note-audio',
  cardType: 'recognition',
  prompt: { cueAudio: originalAudio },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
    answerAudio: originalAudio,
  },
  state: { dueAt: null, queueState: 'new', scheduler: null, source: {} },
  answerAudioSource: 'generated',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-12T00:00:00.000Z',
};

const withAudio = (reference: StudyMediaRef): StudyCardSummary => ({
  ...card,
  prompt: { cueAudio: reference },
  answer: { ...card.answer, answerAudio: reference },
});

const regenerateAndCheckPreview = async (reference: StudyMediaRef) => {
  await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
  await waitFor(() =>
    expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
      'src',
      reference.url
    )
  );
};

describe('StudyCardEditor regenerated audio', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  it.each([false, true])(
    'saves the new clip on both sides with parent refresh=%s',
    async (refresh) => {
      const updatedCard = withAudio(regeneratedAudio);
      const props = {
        card,
        onCancel: vi.fn(),
        onSave: vi.fn(),
        onRegenerateAudio: vi.fn().mockResolvedValue(updatedCard),
      };
      const { rerender } = render(<StudyCardEditor {...props} />);
      await userEvent.clear(screen.getByDisplayValue('company'));
      await userEvent.type(screen.getByLabelText('Answer meaning'), 'A company.');
      await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
      await waitFor(() =>
        expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
          'src',
          regeneratedAudio.url
        )
      );
      if (refresh) rerender(<StudyCardEditor {...props} card={updatedCard} />);
      await userEvent.click(screen.getByRole('button', { name: 'Save card' }));
      expect(props.onSave).toHaveBeenCalledWith({
        prompt: expect.objectContaining({ cueAudio: regeneratedAudio, cueText: null }),
        answer: expect.objectContaining({ answerAudio: regeneratedAudio, meaning: 'A company.' }),
      });
    }
  );

  it('saves the last clip after repeated regeneration', async () => {
    const onSave = vi.fn();
    const onRegenerateAudio = vi
      .fn()
      .mockResolvedValueOnce(withAudio(regeneratedAudio))
      .mockResolvedValueOnce(withAudio(latestAudio));
    render(
      <StudyCardEditor
        card={card}
        onCancel={vi.fn()}
        onSave={onSave}
        onRegenerateAudio={onRegenerateAudio}
      />
    );
    await regenerateAndCheckPreview(regeneratedAudio);
    await regenerateAndCheckPreview(latestAudio);
    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(onSave).toHaveBeenCalledWith({
      prompt: expect.objectContaining({ cueAudio: latestAudio }),
      answer: expect.objectContaining({ answerAudio: latestAudio }),
    });
  });

  it('does not add a listening prompt when regenerating a reading card', async () => {
    const readingCard = { ...card, prompt: { cueText: '会社' } };
    const onSave = vi.fn();
    render(
      <StudyCardEditor
        card={readingCard}
        onCancel={vi.fn()}
        onSave={onSave}
        onRegenerateAudio={vi.fn().mockResolvedValue({
          ...readingCard,
          answer: { ...card.answer, answerAudio: regeneratedAudio },
        })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
    await waitFor(() =>
      expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
        'src',
        regeneratedAudio.url
      )
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(onSave.mock.calls[0][0].prompt).not.toHaveProperty('cueAudio');
    expect(onSave.mock.calls[0][0].answer.answerAudio).toEqual(regeneratedAudio);
  });
});
