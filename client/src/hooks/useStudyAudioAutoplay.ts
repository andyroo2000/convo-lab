import { useCallback, useEffect, useRef } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { AudioPlayerHandle } from '../components/study/StudyAudioPlayer';
import { isAudioLedPromptCard, toAssetUrl } from '../components/study/studyCardUtils';
import { warmAudioCache } from '../lib/audioCache';

const PREWARM_CARD_COUNT = 3;

interface UseStudyAudioAutoplayOptions {
  cards: StudyCardSummary[];
  currentCard: StudyCardSummary | null;
  ensureAnswerAudioPrepared: (cardId: string) => Promise<StudyCardSummary>;
  focusMode: boolean;
  runBackgroundTask: (
    task?: Promise<unknown> | (() => Promise<unknown> | unknown),
    options?: { errorMessage?: string; label?: string; onError?: (message: string) => void }
  ) => void;
  revealed: boolean;
}

export default function useStudyAudioAutoplay({
  cards,
  currentCard,
  ensureAnswerAudioPrepared,
  focusMode,
  runBackgroundTask,
  revealed,
}: UseStudyAudioAutoplayOptions) {
  const promptAudioRef = useRef<AudioPlayerHandle | null>(null);
  const answerAudioRef = useRef<AudioPlayerHandle | null>(null);
  const promptAutoplayKeys = useRef(new Set<string>());
  const answerAutoplayKeys = useRef(new Set<string>());

  const stopAllAudio = useCallback(() => {
    promptAudioRef.current?.stop();
    answerAudioRef.current?.stop();
  }, []);

  const resetAutoplayForCard = useCallback((cardId: string) => {
    const keyPrefix = `${cardId}:`;

    promptAutoplayKeys.current.forEach((key) => {
      if (key.startsWith(keyPrefix)) {
        promptAutoplayKeys.current.delete(key);
      }
    });
    answerAutoplayKeys.current.forEach((key) => {
      if (key.startsWith(keyPrefix)) {
        answerAutoplayKeys.current.delete(key);
      }
    });
  }, []);

  const resetAllAutoplay = useCallback(() => {
    promptAutoplayKeys.current.clear();
    answerAutoplayKeys.current.clear();
  }, []);

  const autoplayAnswerAudioForCard = useCallback(
    (card: StudyCardSummary) => {
      const answerUrl = toAssetUrl(card.answer.answerAudio?.url);
      if (!answerUrl) return;

      const autoplayKey = `${card.id}:answer:${answerUrl}`;
      if (answerAutoplayKeys.current.has(autoplayKey)) return;

      const player = answerAudioRef.current;
      if (!player) return;

      answerAutoplayKeys.current.add(autoplayKey);
      runBackgroundTask(() => player.play(), {
        label: 'Study answer-audio autoplay',
      });
    },
    [runBackgroundTask]
  );

  useEffect(() => {
    if (!focusMode || !cards.length) return;

    const upcomingCards = cards.slice(0, PREWARM_CARD_COUNT);
    const audioUrls = upcomingCards
      .flatMap((card) => [
        toAssetUrl(card.prompt.cueAudio?.url),
        toAssetUrl(card.answer.answerAudio?.url),
      ])
      .filter((url): url is string => Boolean(url));

    warmAudioCache(audioUrls).catch((error) => {
      console.warn('Unable to warm study session audio:', error);
    });

    upcomingCards
      .filter((card) => !toAssetUrl(card.answer.answerAudio?.url))
      .forEach((card) => {
        runBackgroundTask(() => ensureAnswerAudioPrepared(card.id), {
          label: 'Study answer-audio prewarm',
          errorMessage: 'Answer audio could not be prepared.',
        });
      });
  }, [cards, ensureAnswerAudioPrepared, focusMode, runBackgroundTask]);

  useEffect(() => {
    if (!focusMode || !currentCard || revealed || !isAudioLedPromptCard(currentCard)) return;

    const promptUrl = toAssetUrl(currentCard.prompt.cueAudio?.url);
    if (!promptUrl) return;

    const autoplayKey = `${currentCard.id}:prompt:${promptUrl}`;
    if (promptAutoplayKeys.current.has(autoplayKey)) return;

    promptAutoplayKeys.current.add(autoplayKey);
    runBackgroundTask(() => promptAudioRef.current?.play(), {
      label: 'Study prompt-audio autoplay',
    });
  }, [currentCard, focusMode, revealed, runBackgroundTask]);

  useEffect(() => {
    if (!focusMode || !currentCard || !revealed) return;

    autoplayAnswerAudioForCard(currentCard);
  }, [autoplayAnswerAudioForCard, currentCard, focusMode, revealed]);

  return {
    autoplayAnswerAudioForCard,
    promptAudioRef,
    answerAudioRef,
    resetAllAutoplay,
    resetAutoplayForCard,
    stopAllAudio,
  };
}
