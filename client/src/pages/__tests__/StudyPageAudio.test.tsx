import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';
import userEvent from '@testing-library/user-event';

import {
  MockDeviceMotionEvent,
  baseCard,
  configureReturningFailedCardSession,
  getStudyPageTestState,
  renderStudyPage,
  setUpStudyPageTest,
} from './studyPageTestHarness';

const { mutateAsyncMock, prepareStudyAnswerAudioMock, startStudySessionMock } =
  getStudyPageTestState();

const reviewOverview = {
  dueCount: 4,
  newCount: 6,
  learningCount: 2,
  reviewCount: 8,
  suspendedCount: 0,
  totalCards: 20,
};

const singleReviewOverview = {
  ...reviewOverview,
  dueCount: 1,
  newCount: 0,
  learningCount: 0,
  reviewCount: 1,
  totalCards: 1,
};

const audioPrompt = {
  cueAudio: {
    filename: 'listening.mp3',
    url: 'https://example.com/listening.mp3',
    mediaKind: 'audio' as const,
    source: 'imported' as const,
  },
};

const generatedAnswerAudio = {
  filename: 'answer.mp3',
  url: 'https://example.com/answer.mp3',
  mediaKind: 'audio' as const,
  source: 'generated' as const,
};

const configureSingleCardSession = (
  card: StudyCardSummary = baseCard,
  overview: StudyOverview = singleReviewOverview
) => {
  startStudySessionMock.mockResolvedValue({ overview, cards: [card] });
};

const configureAudioLedSession = (answerAudioSource: 'missing' | 'imported' = 'imported') => {
  const card = {
    ...baseCard,
    prompt: audioPrompt,
    answer: {
      ...baseCard.answer,
      answerAudio: answerAudioSource === 'missing' ? null : undefined,
    },
    answerAudioSource,
  };
  startStudySessionMock.mockResolvedValue({ overview: reviewOverview, cards: [card] });
  prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
    ...card,
    id: cardId,
    answer: { ...card.answer, answerAudio: generatedAnswerAudio },
    answerAudioSource: 'generated',
  }));
};

const createAnswerAudioCard = () => ({
  ...baseCard,
  answer: { ...baseCard.answer, answerAudio: generatedAnswerAudio },
  answerAudioSource: 'generated' as const,
});

const startReviewSession = async () => {
  renderStudyPage();
  await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
  await waitFor(() => expect(startStudySessionMock).toHaveBeenCalledTimes(1));
};

const findAudioElement = (label: string) =>
  screen
    .getAllByLabelText(label)
    .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);

describe('StudyPage audio and motion', () => {
  beforeEach(setUpStudyPageTest);

  it('autoplays prompt audio and reuses it on reveal without generating duplicate audio', async () => {
    configureAudioLedSession('missing');
    await startReviewSession();
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Replay answer audio' })).toBeEnabled();
    });
  });

  it('replays prompt audio button clicks without revealing audio-led cards', async () => {
    configureAudioLedSession();
    await startReviewSession();

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
    const promptAudio = findAudioElement('Replay prompt audio');
    expect(promptAudio).not.toBeNull();
    fireEvent.ended(promptAudio!);

    await userEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('company')).not.toBeInTheDocument();
    expect(screen.getByText('Click or push space to reveal')).toBeInTheDocument();
    expect(screen.getByText('Tap to reveal')).toBeInTheDocument();
  });

  it('uses Space to reveal audio-led cards from the front side', async () => {
    configureAudioLedSession();
    await startReviewSession();

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText('company')).toBeInTheDocument();
    });
    expect(screen.queryByText('Click or push space to reveal')).not.toBeInTheDocument();
    expect(screen.queryByText('Tap to reveal')).not.toBeInTheDocument();
  });

  it('autoplays existing answer audio immediately when revealing a card', async () => {
    const originalPlayDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'play'
    );
    const playMock = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });

    try {
      configureSingleCardSession(createAnswerAudioCard());
      await startReviewSession();
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

      expect(playMock).toHaveBeenCalledTimes(1);
      expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Replay answer audio' }));

      expect(playMock).toHaveBeenCalledTimes(2);
    } finally {
      if (originalPlayDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', originalPlayDescriptor);
      }
    }
  });

  it('uses space to restart answer audio after reveal', async () => {
    const playMock = vi.fn().mockImplementation(() => Promise.resolve());
    const pauseMock = vi.fn();

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });

    configureSingleCardSession(createAnswerAudioCard());
    await startReviewSession();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Good/ })).toBeInTheDocument();
    });
    const answerAudio = screen
      .getAllByLabelText('Play answer audio')
      .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);
    expect(answerAudio).not.toBeNull();
    fireEvent.play(answerAudio!);

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(3);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(4);
    });
  });

  it('keeps Space benign after reveal when the card has no answer audio', async () => {
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...baseCard,
      id: cardId,
      answerAudioSource: 'missing' as const,
    }));
    configureSingleCardSession();
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: {
        ...baseCard,
        state: {
          ...baseCard.state,
          queueState: 'review' as const,
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    await startReviewSession();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Good/ })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { code: 'Space' });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'good',
        })
      );
    });
  });

  it('replays audio and accepts keyboard grading when failed cards return', async () => {
    configureReturningFailedCardSession();

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'again',
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('学校')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-2',
          grade: 'good',
        })
      );
    });

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(4);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(5);
    });

    const focusedAnswerAudio = screen
      .getAllByLabelText('Play answer audio')
      .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);
    expect(focusedAnswerAudio).not.toBeNull();
    // Native audio controls can consume event.key; code-based fallback should still grade.
    fireEvent.keyDown(focusedAnswerAudio!, { code: 'Digit3', key: '' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'good',
        })
      );
    });
  });

  it('undoes a reveal with command-z', async () => {
    configureSingleCardSession(baseCard, reviewOverview);
    await startReviewSession();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    expect(screen.getByText('company')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(screen.queryByText('company')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
  });

  it('undoes a reveal when the device is shaken on mobile', async () => {
    configureSingleCardSession(baseCard, reviewOverview);
    await startReviewSession();
    await waitFor(() => {
      expect(MockDeviceMotionEvent.requestPermission).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(screen.getByText('company')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new MockDeviceMotionEvent('devicemotion', {
          accelerationIncludingGravity: { x: 2, y: 2, z: 2 },
        })
      );
      window.dispatchEvent(
        new MockDeviceMotionEvent('devicemotion', {
          accelerationIncludingGravity: { x: 12, y: 10, z: 10 },
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('company')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
  });

  it('hides the unsupported shake-to-undo warning on non-motion devices', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
    });
    configureSingleCardSession(baseCard, reviewOverview);
    await startReviewSession();
    expect(
      screen.queryByText('Shake to undo is not available on this device.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable motion' })).not.toBeInTheDocument();
  });

  it('shows the motion permission affordance when device-motion access is denied', async () => {
    MockDeviceMotionEvent.requestPermission.mockResolvedValueOnce('denied');
    configureSingleCardSession(baseCard, reviewOverview);
    await startReviewSession();

    await waitFor(() => {
      expect(
        screen.getByText('Shake to undo is off because motion access was denied.')
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
