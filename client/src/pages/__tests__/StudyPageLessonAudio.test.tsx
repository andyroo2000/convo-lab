import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  baseCard,
  createImportedTestAudio,
  getStudyPageTestState,
  renderStudyPage,
  setUpStudyPageTest,
} from './studyPageTestHarness';

const { mutateAsyncMock, prepareStudyAnswerAudioMock, startStudyLessonMock } =
  getStudyPageTestState();

const audioCard = (id = 'first'): StudyCardSummary => ({
  ...baseCard,
  id,
  answer: { ...baseCard.answer, answerAudio: createImportedTestAudio(`${id}.mp3`) },
  state: { ...baseCard.state, queueState: 'new' },
});

async function startLesson(cards: StudyCardSummary[] = [audioCard()]) {
  startStudyLessonMock.mockResolvedValue({
    overview: {
      dueCount: 0,
      newCount: cards.length,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: cards.length,
    },
    cards,
  });
  const view = renderStudyPage();
  await userEvent.click(screen.getByRole('button', { name: 'Lessons' }));
  await screen.findByText(`Card 1 of ${cards.length}`);
  return view;
}

const audioElement = () => screen.getByTestId('study-answer-audio-element') as HTMLAudioElement;

describe('lesson preview audio', () => {
  beforeEach(setUpStudyPageTest);

  it('plays and restarts the current lesson audio by button and Space without grading', async () => {
    await startLesson();
    const button = screen.getByRole('button', { name: 'Play answer audio' });
    expect(button).toBeVisible();
    expect(screen.getByTestId('study-answer-audio').innerHTML).not.toContain('md:hidden');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await userEvent.click(button);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    audioElement().currentTime = 4;
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
    expect(audioElement().currentTime).toBe(0);

    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();
  });

  it('reuses imported recognition audio for a prompt-only lesson card', async () => {
    await startLesson([
      { ...baseCard, prompt: { cueAudio: createImportedTestAudio('recognition.mp3') } },
    ]);
    expect(screen.getByTestId('study-answer-audio-source')).toHaveAttribute(
      'src',
      'https://example.com/recognition.mp3'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Play answer audio' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();
  });

  it('stops the previous card and points Space at the newly selected lesson card', async () => {
    const { unmount } = await startLesson([audioCard('first'), audioCard('second')]);
    const firstAudio = audioElement();
    vi.spyOn(firstAudio, 'paused', 'get').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Play answer audio' }));
    firstAudio.currentTime = 3;
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(firstAudio.currentTime).toBe(0);
    expect(screen.getByTestId('study-answer-audio-source')).toHaveAttribute(
      'src',
      'https://example.com/second.mp3'
    );
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.instances[1]).toBe(audioElement());

    unmount();
    fireEvent.keyDown(window, { code: 'Space' });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('keeps Space benign and hides the play control when the lesson has no audio', async () => {
    let finishPreparation!: (card: StudyCardSummary) => void;
    prepareStudyAnswerAudioMock.mockReturnValue(
      new Promise<StudyCardSummary>((resolve) => {
        finishPreparation = resolve;
      })
    );
    await startLesson([baseCard]);
    expect(screen.queryByRole('button', { name: 'Play answer audio' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(prepareStudyAnswerAudioMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeVisible();

    finishPreparation(audioCard(baseCard.id));
    await userEvent.click(await screen.findByRole('button', { name: 'Play answer audio' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('ignores modified, repeated, composing, and already handled Space presses', async () => {
    await startLesson();
    ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'repeat', 'isComposing'].forEach((flag) => {
      expect(fireEvent.keyDown(window, { code: 'Space', [flag]: true })).toBe(true);
    });
    const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('leaves editable and native controls in charge of their own Space presses', async () => {
    await startLesson();
    ['input', 'textarea', 'select'].forEach((tag) => {
      const input = document.createElement(tag);
      document.body.append(input);
      expect(fireEvent.keyDown(input, { code: 'Space' })).toBe(true);
      input.remove();
    });
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const text = document.createElement('span');
    editor.append(text);
    document.body.append(editor);
    expect(fireEvent.keyDown(text, { code: 'Space' })).toBe(true);
    editor.remove();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    screen.getByRole('button', { name: 'Play answer audio' }).focus();
    await userEvent.keyboard(' ');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('returns Space to review reveal after starting the quiz', async () => {
    await startLesson();
    await userEvent.click(screen.getByRole('button', { name: 'Start quiz' }));
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Replay answer audio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
