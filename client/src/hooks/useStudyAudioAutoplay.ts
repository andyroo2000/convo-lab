import { useCallback, useEffect, useRef } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { AudioPlayerHandle } from '../components/study/StudyCardPreview';
import { isAudioLedPromptCard, toAssetUrl } from '../components/study/studyCardUtils';

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

  useEffect(() => {
    if (!focusMode || !cards.length) return;

    cards
      .slice(0, PREWARM_CARD_COUNT)
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

    const answerUrl = toAssetUrl(currentCard.answer.answerAudio?.url);
    if (!answerUrl) return;

    const autoplayKey = `${currentCard.id}:answer:${answerUrl}`;
    if (answerAutoplayKeys.current.has(autoplayKey)) return;

    answerAutoplayKeys.current.add(autoplayKey);
    runBackgroundTask(() => answerAudioRef.current?.play(), {
      label: 'Study answer-audio autoplay',
    });
  }, [currentCard, focusMode, revealed, runBackgroundTask]);

  return {
    promptAudioRef,
    answerAudioRef,
    resetAutoplayForCard,
    stopAllAudio,
  };
}
