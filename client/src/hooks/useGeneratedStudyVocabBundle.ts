import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  StudyVocabBundle,
  StudyVocabBundleCandidate,
  StudyVocabBundleGenerateRequest,
} from '@languageflow/shared/src/types';

import {
  buildStudyCandidateCommitItem,
  createStudyCandidateDraft,
  type StudyCandidateDraft,
} from '../components/study/studyCandidateModel';

import {
  useCommitStudyVocabBundle,
  useGenerateStudyVocabBundle,
  useRegenerateStudyCardCandidatePreviewAudio,
} from './useStudy';

export interface StudyVocabVariantDraft {
  meta: Omit<StudyVocabBundleCandidate, 'candidate'>;
  draft: StudyCandidateDraft;
}

function toVariantDraft(variant: StudyVocabBundleCandidate): StudyVocabVariantDraft {
  const { candidate, ...meta } = variant;
  return {
    meta,
    draft: createStudyCandidateDraft(candidate),
  };
}

function useGeneratedStudyVocabBundle() {
  const { t } = useTranslation('study');
  const generateBundle = useGenerateStudyVocabBundle();
  const commitBundle = useCommitStudyVocabBundle();
  const regenerateAudio = useRegenerateStudyCardCandidatePreviewAudio();
  const [bundle, setBundle] = useState<StudyVocabBundle | null>(null);
  const [variantDrafts, setVariantDrafts] = useState<StudyVocabVariantDraft[]>([]);
  const [learnerContextSummary, setLearnerContextSummary] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [regeneratingCandidateId, setRegeneratingCandidateId] = useState<string | null>(null);
  const [regenerateErrors, setRegenerateErrors] = useState<Record<string, string>>({});
  const [previewDraftIndex, setPreviewDraftIndex] = useState<number | null>(null);
  const variantDraftsRef = useRef<StudyVocabVariantDraft[]>([]);
  const activeRegenerationCandidateIdRef = useRef<string | null>(null);

  const setDrafts = useCallback((next: StudyVocabVariantDraft[]) => {
    variantDraftsRef.current = next;
    setVariantDrafts(next);
  }, []);

  const clear = useCallback(() => {
    setBundle(null);
    setDrafts([]);
    setLearnerContextSummary(null);
    setSuccess(null);
    activeRegenerationCandidateIdRef.current = null;
    setRegeneratingCandidateId(null);
    setRegenerateErrors({});
    setPreviewDraftIndex(null);
  }, [setDrafts]);

  const generate = useCallback(
    async (payload: StudyVocabBundleGenerateRequest) => {
      setSuccess(null);
      setBundle(null);
      setDrafts([]);
      const result = await generateBundle.mutateAsync(payload);
      setBundle(result.bundle);
      setLearnerContextSummary(result.learnerContextSummary ?? null);
      setDrafts(result.bundle.variants.map(toVariantDraft));
    },
    [generateBundle, setDrafts]
  );

  const regenerateVariantAudio = useCallback(
    async (index: number) => {
      const variant = variantDraftsRef.current[index];
      if (!variant) return;
      const candidateId = variant.draft.candidate.clientId;
      if (activeRegenerationCandidateIdRef.current) return;
      activeRegenerationCandidateIdRef.current = candidateId;
      setRegeneratingCandidateId(candidateId);
      setRegenerateErrors((current) => {
        const { [candidateId]: _cleared, ...rest } = current;
        return rest;
      });
      try {
        const result = await regenerateAudio.mutateAsync({
          candidate: buildStudyCandidateCommitItem(variant.draft),
        });
        setDrafts(
          variantDraftsRef.current.map((current, currentIndex) =>
            currentIndex === index
              ? {
                  ...current,
                  draft: {
                    ...current.draft,
                    candidate: {
                      ...current.draft.candidate,
                      prompt: result.prompt,
                      answer: result.answer,
                      previewAudio: result.previewAudio,
                      previewAudioRole: result.previewAudioRole,
                    },
                    previewAudio: result.previewAudio,
                    previewAudioRole: result.previewAudioRole,
                  },
                }
              : current
          )
        );
      } catch (error) {
        setRegenerateErrors((current) => ({
          ...current,
          [candidateId]:
            error instanceof Error ? error.message : 'Unable to regenerate preview audio.',
        }));
      } finally {
        if (activeRegenerationCandidateIdRef.current === candidateId) {
          activeRegenerationCandidateIdRef.current = null;
          setRegeneratingCandidateId(null);
        }
      }
    },
    [regenerateAudio, setDrafts]
  );

  const commit = useCallback(async () => {
    if (!bundle) return;
    const result = await commitBundle.mutateAsync({
      targetWord: bundle.targetWord,
      targetReading: bundle.targetReading ?? null,
      targetMeaning: bundle.targetMeaning ?? null,
      sourceSentence: bundle.sourceSentence ?? null,
      sourceContext: bundle.sourceContext ?? null,
      sentences: bundle.sentences,
      variants: variantDraftsRef.current.map((variant) => ({
        clientId: variant.meta.clientId,
        stage: variant.meta.stage,
        variantKind: variant.meta.variantKind,
        variantSentenceOrdinal: variant.meta.variantSentenceOrdinal ?? null,
        candidate: buildStudyCandidateCommitItem(variant.draft),
      })),
    });
    setSuccess(t('create.generatedSuccess', { count: result.drafts.length }));
    setBundle(null);
    setDrafts([]);
    setLearnerContextSummary(null);
    setPreviewDraftIndex(null);
  }, [bundle, commitBundle, setDrafts, t]);

  return {
    bundle,
    clear,
    commit,
    commitBundle,
    generate,
    generateBundle,
    learnerContextSummary,
    previewDraftIndex,
    regenerateVariantAudio,
    regenerateErrors,
    regeneratingCandidateId,
    setPreviewDraftIndex,
    success,
    variantDrafts,
  };
}

export default useGeneratedStudyVocabBundle;
