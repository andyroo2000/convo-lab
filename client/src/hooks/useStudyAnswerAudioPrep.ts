import { useCallback, useEffect, useRef } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { prepareStudyAnswerAudio } from './useStudy';
import { toAssetUrl } from '../components/study/studyCardUtils';
import { warmAudioCache } from '../lib/audioCache';

const ANSWER_AUDIO_PREP_MAX_ATTEMPTS = 4;
const ANSWER_AUDIO_PREP_RETRY_DELAY_MS = 300;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface UseStudyAnswerAudioPrepOptions {
  enabled: boolean;
  mergeCardIntoSession: (updatedCard: StudyCardSummary) => void;
  onError: (message: string) => void;
}

export default function useStudyAnswerAudioPrep({
  enabled,
  mergeCardIntoSession,
  onError,
}: UseStudyAnswerAudioPrepOptions) {
  const inFlightAudioPrep = useRef<Map<string, Promise<StudyCardSummary>>>(new Map());
  const isMountedRef = useRef(true);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const inFlightAudioPrepMap = inFlightAudioPrep.current;

    return () => {
      isMountedRef.current = false;
      inFlightAudioPrepMap.clear();
    };
  }, []);

  return useCallback(
    async (cardId: string) => {
      const existingPromise = inFlightAudioPrep.current.get(cardId);
      if (existingPromise) {
        return existingPromise;
      }

      const request = (async () => {
        const attemptPrepare = async (attempt: number): Promise<StudyCardSummary> => {
          const updatedCard = await prepareStudyAnswerAudio(cardId);

          if (isMountedRef.current && enabledRef.current) {
            mergeCardIntoSession(updatedCard);
          }

          const answerAudioUrl = toAssetUrl(updatedCard.answer.answerAudio?.url);
          if (answerAudioUrl) {
            warmAudioCache([answerAudioUrl]).catch((error) => {
              console.warn('Unable to warm prepared answer audio:', error);
            });
          }

          if (answerAudioUrl || attempt >= ANSWER_AUDIO_PREP_MAX_ATTEMPTS - 1) {
            return updatedCard;
          }

          await delay(ANSWER_AUDIO_PREP_RETRY_DELAY_MS);

          return attemptPrepare(attempt + 1);
        };

        return attemptPrepare(0);
      })()
        .catch((error) => {
          console.warn('Unable to prepare answer audio for study card:', cardId, error);
          if (isMountedRef.current && enabledRef.current) {
            onError(error instanceof Error ? error.message : 'Answer audio could not be prepared.');
          }
          throw error;
        })
        .finally(() => {
          inFlightAudioPrep.current.delete(cardId);
        });

      inFlightAudioPrep.current.set(cardId, request);
      return request;
    },
    [mergeCardIntoSession, onError]
  );
}
