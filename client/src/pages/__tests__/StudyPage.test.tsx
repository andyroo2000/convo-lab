import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonRequestError } from '../../lib/apiClient';

import {
  baseCard,
  getStudyPageTestState,
  renderStudyPage,
  setUpStudyPageTest,
} from './studyPageTestHarness';

const {
  masteryAnimationFinishesImmediately,
  mutateAsyncMock,
  prepareStudyAnswerAudioMock,
  reviewMutationError,
  startStudyLessonMock,
  startStudySessionMock,
  studyOverviewData,
  studyOverviewLoading,
} = getStudyPageTestState();

describe('StudyPage overview and lessons', () => {
  beforeEach(setUpStudyPageTest);

  it('renders overview counts without eagerly starting a study session', () => {
    renderStudyPage();

    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument();
    expect(screen.getByText('4', { selector: '.study-count strong' })).toBeInTheDocument();
    expect(screen.queryByText('Due')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Card' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse cards/ })).toHaveAttribute(
      'href',
      '/app/study/browse'
    );
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh counts' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to study')).not.toBeInTheDocument();
    expect(screen.queryByText('Available now')).not.toBeInTheDocument();
    expect(screen.queryByText('Load strategy')).not.toBeInTheDocument();
    expect(screen.queryByText('Keyboard')).not.toBeInTheDocument();
    expect(startStudySessionMock).not.toHaveBeenCalled();
  });

  it('shows loading instead of a false empty state while the review session resolves', async () => {
    let resolveSession!: () => void;
    startStudySessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = () =>
          resolve({
            overview: studyOverviewData.current,
            cards: [baseCard],
          });
      })
    );

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));

    expect(screen.getByText('Loading study session…')).toBeInTheDocument();
    expect(screen.queryByText(/No cards are ready right now/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveSession();
    });

    expect(await screen.findByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
  });

  it('associates the disabled Reviews button with the empty-state message', () => {
    studyOverviewData.current = {
      dueCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 20,
      newCardsAvailableToday: 0,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 20,
    };

    renderStudyPage();

    const emptyMessage = 'Open Cards to create your first card and start studying here.';
    const beginButton = screen.getByRole('button', { name: 'Start review' });
    const emptyState = screen.getByText(emptyMessage);
    expect(beginButton).toBeDisabled();
    expect(beginButton.getAttribute('aria-describedby')?.split(' ')).toContain(emptyState.id);
    expect(beginButton).toHaveAccessibleDescription(`0 cards due All caught up ${emptyMessage}`);
    expect(beginButton).not.toHaveAttribute('title');
  });

  it('does not report future failed retries as reviews that are due', () => {
    studyOverviewData.current = {
      dueCount: 0,
      failedCount: 8,
      failedDueCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 20,
      newCardsAvailableToday: 0,
      learningCount: 8,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 8,
      nextDueAt: '2999-07-29T12:00:00.000Z',
    };

    renderStudyPage();

    expect(screen.getByRole('button', { name: 'Start review' })).toHaveAccessibleDescription(
      /^0 cards due/
    );
    expect(screen.queryByText('8 reviews')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start review' })).toBeDisabled();
  });

  it('includes failed retries whose due time has arrived', () => {
    studyOverviewData.current = {
      dueCount: 2,
      failedCount: 8,
      failedDueCount: 3,
      newCount: 0,
      learningCount: 8,
      reviewCount: 2,
      suspendedCount: 0,
      totalCards: 10,
    };

    renderStudyPage();

    expect(screen.getByText('5', { selector: '.study-count strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start review' })).toBeEnabled();
  });

  it('points to Lessons when reviews are exhausted but new cards remain', () => {
    studyOverviewData.current = {
      dueCount: 0,
      newCount: 6,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 0,
      newCardsAvailableToday: 6,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 6,
    };

    renderStudyPage();

    expect(screen.getByRole('button', { name: 'Start review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start lesson' })).toBeEnabled();
    expect(
      screen.getByText('No reviews are due. You can start a Lesson whenever you’re ready.')
    ).toBeInTheDocument();
  });

  it('finishes a lesson when its last quiz card is buried', async () => {
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 1,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new',
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start lesson' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'More card options' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bury for session' }));

    expect(screen.getByText('Lesson complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn another batch' })).toBeInTheDocument();
  });

  it('keeps the last lesson card and feedback lane visible until mastery feedback finishes', async () => {
    masteryAnimationFinishesImmediately.current = false;
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 1,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new',
          },
        },
      ],
    });
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'lesson-review-1',
      card: {
        ...baseCard,
        masteryLevel: 'guru',
        state: {
          ...baseCard.state,
          dueAt: '2026-08-01T12:00:00.000Z',
          queueState: 'learning',
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 1,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start lesson' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Again' }));
    expect(await screen.findByRole('group', { name: '1 failed, 0 remaining' })).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(
      within(await screen.findByTestId('mastery-feedback-lane')).getByTestId(
        'mastery-animation-stub'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('study-focus-card-scroll')).toBeInTheDocument();
    expect(screen.queryByText('Lesson complete')).not.toBeInTheDocument();

    // Simulate the animation completion callback; the real overlay ignores pointer input.
    fireEvent.click(screen.getByRole('button', { name: 'Finish mastery animation' }));

    expect(await screen.findByText('Lesson complete')).toBeInTheDocument();
  });

  it('offers a retry only for an ambiguous review result', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [baseCard],
    });
    mutateAsyncMock.mockImplementationOnce(async () => {
      reviewMutationError.current = new TypeError('Network connection lost');
      throw reviewMutationError.current;
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(await screen.findByRole('button', { name: 'Retry this review' })).toBeInTheDocument();
  });

  it('shows conflict recovery without offering a fresh review submission', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [baseCard],
    });
    mutateAsyncMock.mockImplementationOnce(async () => {
      reviewMutationError.current = new JsonRequestError('Out of order. (409)', 409, {
        code: 'review_out_of_order',
      });
      throw reviewMutationError.current;
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(
      await screen.findByText(
        'Review status changed on the server. Your Study session was refreshed.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry this review' })).not.toBeInTheDocument();
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('previews one lesson card at a time before starting the isolated quiz', async () => {
    const secondCard = {
      ...baseCard,
      id: 'card-2',
      noteId: 'note-2',
      prompt: { cueText: '学校', cueReading: 'がっこう' },
      answer: {
        expression: '学校',
        expressionReading: '学校[がっこう]',
        meaning: 'school',
      },
      state: {
        ...baseCard.state,
        queueState: 'new' as const,
      },
    };
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 2,
        newCardsPerDay: 20,
        newCardsAvailableToday: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new' as const,
          },
        },
        secondCard,
      ],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => {
      const card = cardId === secondCard.id ? secondCard : baseCard;
      return {
        ...card,
        answer: {
          ...card.answer,
          answerAudio: {
            filename: `${cardId}.mp3`,
            url: `https://example.com/${cardId}.mp3`,
            mediaKind: 'audio' as const,
            source: 'generated' as const,
          },
        },
        answerAudioSource: 'generated' as const,
      };
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start lesson' }));

    expect(await screen.findByText('Card 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.queryByText('学校')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Start quiz' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('学校')).toBeInTheDocument();
    expect(screen.queryByText('会社')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
  });

  it('autoplays an audio-recognition prompt when the lesson quiz starts', async () => {
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'lesson-prompt.mp3',
              url: 'https://example.com/lesson-prompt.mp3',
              mediaKind: 'audio' as const,
              source: 'imported' as const,
            },
          },
          state: {
            ...baseCard.state,
            queueState: 'new' as const,
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start lesson' }));

    expect(await screen.findByText('Card 1 of 1')).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Start quiz' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps Reviews enabled while overview counts are loading', () => {
    studyOverviewLoading.current = true;
    studyOverviewData.current = undefined;

    renderStudyPage();

    const beginButton = screen.getByRole('button', { name: 'Start review' });
    expect(beginButton).toBeEnabled();
    expect(beginButton).toHaveAccessibleDescription('0 cards due All caught up');
    expect(screen.getByText('Loading overview…')).toBeInTheDocument();
    expect(
      screen.queryByText('Open Cards to create your first card and start studying here.')
    ).not.toBeInTheDocument();
  });

  it('starts the study session only when Reviews is clicked', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        failedDueCount: 2,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(startStudySessionMock).toHaveBeenCalledWith();
    expect(screen.getByText('Use Reveal answer or press Space.')).toBeInTheDocument();
    expect(screen.getByText('Use Reveal answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /hear answer|play prompt audio/i })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('study-review-metrics')).not.toHaveClass('border-b');
    expect(screen.getByRole('group', { name: '2 failed, 4 remaining' })).toBeInTheDocument();
    expect(screen.getByTestId('study-focus-shell')).toHaveClass('study-focus-shell');
    expect(screen.getByTestId('study-focus-shell')).toHaveClass('overflow-x-hidden');
    expect(screen.queryByTestId('mastery-feedback-lane')).not.toBeInTheDocument();
    expect(screen.getByTestId('study-focus-card-scroll')).toHaveClass(
      'study-focus-scroll',
      'overflow-x-hidden'
    );
    expect(screen.getByTestId('study-focus-card-scroll').className).not.toContain('pb-24');
  });

  it.each(['Space', 'Enter'])('reveals with the %s keyboard action', async (key) => {
    startStudySessionMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [baseCard],
    });
    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    if (key === 'Enter') screen.getByRole('button', { name: 'Reveal answer' }).focus();
    await userEvent.keyboard(key === 'Space' ? '[Space]' : '[Enter]');
    expect(screen.getByTestId('study-grade-tray')).toBeInTheDocument();
  });

  it('keeps grade controls accessible separately from revealed-card maintenance actions', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    const gradeTray = screen.getByTestId('study-grade-tray');
    expect(screen.getByTestId('study-focus-shell')).toHaveClass('study-focus-shell', 'min-h-0');
    expect(screen.getByTestId('study-focus-card-scroll')).toHaveClass(
      'study-focus-scroll',
      'min-h-0',
      'overflow-y-auto',
      'overflow-x-hidden'
    );
    expect(gradeTray).toHaveClass('fixed');
    expect(gradeTray.className).not.toContain('md:static');
    expect(screen.getByTestId('study-grade-tray-inner')).toHaveClass('mx-auto', 'max-w-3xl');
    expect(gradeTray.className).not.toContain('md:pb-6');
    const againButton = within(gradeTray).getByRole('button', { name: /again/i });
    expect(againButton.className).not.toContain('md:min-h-[8.25rem]');
    expect(againButton).toBeInTheDocument();
    expect(within(gradeTray).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Play answer audio' })).toBeEnabled();
    expect(within(gradeTray).getByRole('button', { name: /hard/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /good/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /easy/i })).toBeInTheDocument();
    expect(within(gradeTray).queryByRole('button', { name: 'Edit card' })).not.toBeInTheDocument();

    const reviewHeader = screen.getByTestId('study-review-header');
    const reviewActions = within(reviewHeader).getByTestId('study-review-actions');
    expect(within(reviewActions).getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('More card options'));
    expect(within(reviewActions).getByRole('button', { name: 'Set due' })).toBeInTheDocument();
    await userEvent.keyboard('[Escape]');
    expect(screen.queryByRole('button', { name: 'Set due' })).not.toBeInTheDocument();
    expect(gradeTray).toBeInTheDocument();
    expect(
      within(gradeTray).queryByRole('button', { name: 'Play answer audio' })
    ).not.toBeInTheDocument();
  });
});
