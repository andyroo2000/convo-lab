import { useCallback, useEffect, useRef } from 'react';
import type { StudyCardSummary } from '@shared/types';

import type { AudioPlayerHandle } from '../components/study/StudyCardPreview';
import { isAudioLedPromptCard, toAssetUrl } from '../components/study/studyCardUtils';

const PREWARM_CARD_COUNT = 3;

interface UseStudyAudioAutoplayOptions {
  cards: StudyCardSummary[];
  currentCard: StudyCardSummary | null;
  ensureAnswerAudioPrepared: (cardId: string) => Promise<StudyCardSummary>;
  focusMode: boolean;
  ignorePromise: (task?: Promise<unknown>) => void;
  revealed: boolean;
}

export default function useStudyAudioAutoplay({
  cards,
  currentCard,
  ensureAnswerAudioPrepared,
  focusMode,
  ignorePromise,
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

  useEffect(() => {
    if (!focusMode || !cards.length) return;

    cards
      .slice(0, PREWARM_CARD_COUNT)
      .filter((card) => !toAssetUrl(card.answer.answerAudio?.url))
      .forEach((card) => {
        ignorePromise(ensureAnswerAudioPrepared(card.id));
      });
  }, [cards, ensureAnswerAudioPrepared, focusMode, ignorePromise]);

  useEffect(() => {
    if (!focusMode || !currentCard || revealed || !isAudioLedPromptCard(currentCard)) return;

    const promptUrl = toAssetUrl(currentCard.prompt.cueAudio?.url);
    if (!promptUrl) return;

    const autoplayKey = `${currentCard.id}:prompt:${promptUrl}`;
    if (promptAutoplayKeys.current.has(autoplayKey)) return;

    promptAutoplayKeys.current.add(autoplayKey);
    ignorePromise(promptAudioRef.current?.play());
  }, [currentCard, focusMode, ignorePromise, revealed]);

  useEffect(() => {
    if (!focusMode || !currentCard || !revealed) return;

    const answerUrl = toAssetUrl(currentCard.answer.answerAudio?.url);
    if (!answerUrl) return;

    const autoplayKey = `${currentCard.id}:answer:${answerUrl}`;
    if (answerAutoplayKeys.current.has(autoplayKey)) return;

    answerAutoplayKeys.current.add(autoplayKey);
    ignorePromise(answerAudioRef.current?.play());
  }, [currentCard, focusMode, ignorePromise, revealed]);

  return {
    promptAudioRef,
    answerAudioRef,
    stopAllAudio,
  };
}
