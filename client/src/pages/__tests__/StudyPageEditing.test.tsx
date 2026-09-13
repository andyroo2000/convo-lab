import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  baseCard,
  chooseAnswerAudioVoice,
  getStudyPageTestState,
  pageEmptyAchievementProgress,
  renderStudyPage,
  setUpStudyPageTest,
} from './studyPageTestHarness';

const {
  cardActionMutateAsyncMock,
  deleteStudyCardMock,
  getAchievementProgressMock,
  mutateAsyncMock,
  regenerateStudyAnswerAudioMock,
  startStudyIntroductionCohortLessonMock,
  startStudySessionMock,
  studyOverviewData,
  undoStudyReviewMock,
  updateStudyCardMock,
} = getStudyPageTestState();

describe('StudyPage editing and session actions', () => {
  beforeEach(setUpStudyPageTest);

  it('undoes a graded card with command-z and restores the previous revealed card', async () => {
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: {
        ...baseCard,
        state: {
          ...baseCard.state,
          queueState: 'review',
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
    });
    undoStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: baseCard,
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Nice work/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(undoStudyReviewMock).toHaveBeenCalledWith('review-1');
    });
    expect(screen.getByText('company')).toBeInTheDocument();
    expect(screen.queryByText(/Nice work/i)).not.toBeInTheDocument();
  });

  it('opens an in-place editor on the answer side and returns to the front after save', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'card-1.mp3',
              url: 'https://example.com/card-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Edit card' }));

    const meaningInput = screen.getByLabelText('Answer meaning');
    await userEvent.clear(meaningInput);
    await userEvent.type(meaningInput, 'business');

    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(updateStudyCardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          answer: expect.objectContaining({
            meaning: 'business',
          }),
        })
      );
    });

    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save card' })).not.toBeInTheDocument();
  });

  it('closes the delete confirmation and shows an error when card deletion fails', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });
    deleteStudyCardMock.mockRejectedValue(new Error('Delete failed.'));

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }));

    expect(screen.getByText('Delete this card? This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('modal-button-confirm'));

    await waitFor(() => {
      expect(deleteStudyCardMock).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(
        screen.queryByText('Delete this card? This cannot be undone.')
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Delete failed.')).toHaveLength(1);
  });

  it('deletes the current card from the review session after confirmation', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }));
    await userEvent.click(screen.getByTestId('modal-button-confirm'));

    await waitFor(() => {
      expect(deleteStudyCardMock).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          'No cards are ready right now. Import more cards or come back when something is due.'
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('Delete this card? This cannot be undone.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument();
    expect(screen.queryByText('company')).not.toBeInTheDocument();
  });

  it('regenerates answer audio from the in-place editor', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudioVoiceId: 'ja-JP-Wavenet-D',
            answerAudioTextOverride: 'かいしゃ',
            answerAudio: {
              filename: 'card-1.mp3',
              url: 'https://example.com/card-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));

    expect(screen.getByLabelText('Answer audio voice')).toHaveTextContent('Naoki');
    expect(screen.getByLabelText('Phonetic audio override')).toHaveValue('かいしゃ');
    const currentAudio = screen.getByLabelText('Current card audio');
    const answerAudioVoice = screen.getByLabelText('Answer audio voice');
    expect(currentAudio).toBeInTheDocument();
    expect(currentAudio).toAppearBefore(answerAudioVoice);
    expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
      'src',
      'https://example.com/card-1.mp3'
    );

    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    await chooseAnswerAudioVoice(/Sato/);
    await userEvent.clear(screen.getByLabelText('Phonetic audio override'));
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かぶしきがいしゃ');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    await waitFor(() => {
      expect(regenerateStudyAnswerAudioMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        answerAudioVoiceId: 'fishaudio:875668667eb94c20b09856b971d9ca2f',
        answerAudioTextOverride: 'かぶしきがいしゃ',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
        'src',
        'https://example.com/card-1-regenerated.mp3'
      );
    });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
  });

  it('buries the current card for the session and restores it with Cmd+Z', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bury for session' }));

    expect(
      screen.getByText(
        'No cards are ready right now. Import more cards or come back when something is due.'
      )
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    expect(await screen.findByRole('button', { name: 'Bury for session' })).toBeInTheDocument();
  });

  it('suspends a revealed card and removes it from the active session', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    await waitFor(() => {
      expect(cardActionMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          action: 'suspend',
        })
      );
    });

    expect(
      screen.getByText(
        'No cards are ready right now. Import more cards or come back when something is due.'
      )
    ).toBeInTheDocument();
  });

  it('sends the device timezone when setting a revealed card due tomorrow', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set due' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));

    await waitFor(() => {
      expect(cardActionMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          action: 'set_due',
          mode: 'tomorrow',
          timeZone: 'America/New_York',
        })
      );
    });
  });

  it('shows the session wrap-up and practices toughest cards without new reviews', async () => {
    const cardBefore = {
      ...baseCard,
      state: {
        ...baseCard.state,
        scheduler: {
          due: '2026-08-25T12:00:00.000Z',
          stability: 6,
          difficulty: 5,
          elapsed_days: 3,
          scheduled_days: 6,
          learning_steps: 0,
          reps: 4,
          lapses: 0,
          state: 2,
          last_review: '2026-08-19T12:00:00.000Z',
        },
      },
    };
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [cardBefore],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-wrap-up',
      card: {
        ...cardBefore,
        state: {
          ...cardBefore.state,
          dueAt: '2026-09-02T12:00:00.000Z',
          scheduler: {
            ...cardBefore.state.scheduler,
            due: '2026-09-02T12:00:00.000Z',
            stability: 8,
            scheduled_days: 8,
          },
        },
      },
      overview: {
        dueCount: 0,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('First-pass recall')).toBeInTheDocument();
    expect(screen.queryByText(/Ranked using/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Practice 1' }));
    expect(screen.getByText('Practice only')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('Practice complete')).toBeInTheDocument();
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows a partial wrap-up when ending a review session with cards remaining', async () => {
    const remainingCard = {
      ...baseCard,
      id: 'card-2',
      noteId: 'note-2',
      prompt: { cueText: '学校', cueReading: 'がっこう' },
      answer: {
        expression: '学校',
        expressionReading: '学校[がっこう]',
        meaning: 'school',
      },
    };
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 2,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 2,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [baseCard, remainingCard],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-before-early-exit',
      card: {
        ...baseCard,
        state: { ...baseCard.state, dueAt: '2026-09-25T12:00:00.000Z' },
      },
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 2,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));
    await userEvent.click(await screen.findByRole('button', { name: 'End session' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('Here’s what you reviewed this session.')).toBeInTheDocument();
    expect(screen.queryByText('学校')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('study-session-wrap-up')).getByText('1', { selector: 'p' })
    ).toBeInTheDocument();
  });

  it('awards the Orbit achievement before wrap-up and moves it onto Study', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 100,
        masterySpread: { apprentice: 0, guru: 0, master: 0, enlightened: 1, burned: 99 },
      },
      cards: [{ ...baseCard, masteryLevel: 'enlightened' }],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-burned-100',
      card: {
        ...baseCard,
        masteryLevel: 'burned',
        state: { ...baseCard.state, dueAt: '2027-08-25T12:00:00.000Z' },
      },
      overview: {
        dueCount: 0,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 100,
        masterySpread: { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 100 },
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    getAchievementProgressMock.mockResolvedValue({
      ...pageEmptyAchievementProgress,
      metricValues: { 'mastery.burned': 100 },
      awards: [{ id: 'burned.burned100', earnedAt: '2026-08-25T12:00:00.000Z' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByTestId('study-achievement-award')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '100 items burned' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByTestId('study-session-achievements')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByTestId('study-recent-milestones')).toBeInTheDocument();
    expect(screen.queryByText('View all')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Recent milestones/ })).not.toBeInTheDocument();
  });

  it('opens a requested lesson-follow-up cohort directly in lesson preview', async () => {
    startStudyIntroductionCohortLessonMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [{ ...baseCard, state: { ...baseCard.state, queueState: 'new' } }],
    });
    window.history.replaceState({}, '', '/app/study?lessonCohortId=01k00000000000000000000000');

    renderStudyPage();

    await waitFor(() =>
      expect(startStudyIntroductionCohortLessonMock).toHaveBeenCalledWith(
        '01k00000000000000000000000'
      )
    );
    expect(await screen.findByText('Preview this lesson')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('lessonCohortId')).toBe(false);
  });
});
