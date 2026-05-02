import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT } from '@languageflow/shared/src/studyConstants';
import type {
  StudyCardCandidateGenerateRequest,
  StudyCardCandidatePreviewImageResponse,
} from '@languageflow/shared/src/types';

import {
  buildStudyCandidateCommitItem,
  createStudyCandidateDraft,
  hasVisualProductionPreview,
  STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS,
  type StudyCandidateDraft,
} from '../components/study/studyCandidateModel';
import type { StudyCardFormValues } from '../components/study/studyCardFormModel';

import {
  useCommitStudyCardCandidates,
  useGenerateStudyCardCandidates,
  useRegenerateStudyCardCandidatePreviewAudio,
  useRegenerateStudyCardCandidatePreviewImage,
} from './useStudy';

function removeErrorForCandidate(
  current: Record<string, string>,
  candidateId: string
): Record<string, string> {
  const { [candidateId]: _removed, ...remaining } = current;
  return remaining;
}

function useGeneratedStudyCandidates() {
  const { t } = useTranslation('study');
  const generateCandidates = useGenerateStudyCardCandidates();
  const commitCandidates = useCommitStudyCardCandidates();
  const regenerateCandidateAudio = useRegenerateStudyCardCandidatePreviewAudio();
  const regenerateCandidateImage = useRegenerateStudyCardCandidatePreviewImage();
  const [success, setSuccess] = useState<string | null>(null);
  const [learnerContextSummary, setLearnerContextSummary] = useState<string | null>(null);
  const [candidateDrafts, setCandidateDraftsState] = useState<StudyCandidateDraft[]>([]);
  const [regeneratingCandidateId, setRegeneratingCandidateId] = useState<string | null>(null);
  const [regenerateErrorByCandidateId, setRegenerateErrorByCandidateId] = useState<
    Record<string, string>
  >({});
  const [regenerateImageErrorByCandidateId, setRegenerateImageErrorByCandidateId] = useState<
    Record<string, string>
  >({});
  const [regeneratingImageCandidateId, setRegeneratingImageCandidateId] = useState<string | null>(
    null
  );
  const [previewDraftIndex, setPreviewDraftIndex] = useState<number | null>(null);
  const activeRegenerationCandidateIdRef = useRef<string | null>(null);
  const activeImageRegenerationCandidateIdRef = useRef<string | null>(null);
  const candidateDraftsRef = useRef<StudyCandidateDraft[]>([]);
  const generationTokenRef = useRef(0);

  const setCandidateDrafts = useCallback(
    (
      updater: StudyCandidateDraft[] | ((current: StudyCandidateDraft[]) => StudyCandidateDraft[])
    ) => {
      setCandidateDraftsState((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        candidateDraftsRef.current = next;
        return next;
      });
    },
    []
  );

  const isCandidateAudioRegenerating = regeneratingCandidateId !== null;
  const isCandidateImageRegenerating = regeneratingImageCandidateId !== null;
  const selectedCount = candidateDrafts.filter((draft) => draft.selected).length;

  const applyImageResult = useCallback(
    (candidateId: string, result: StudyCardCandidatePreviewImageResponse) => {
      setCandidateDrafts((current) =>
        // If a newer generation replaced the draft list while this request was in flight,
        // the old clientId will not match anything and the stale image result is dropped.
        current.map((currentDraft) =>
          currentDraft.candidate.clientId === candidateId
            ? {
                ...currentDraft,
                candidate: {
                  ...currentDraft.candidate,
                  prompt: result.prompt,
                  previewImage: result.previewImage,
                  imagePrompt: result.imagePrompt,
                },
                previewImage: result.previewImage,
                imagePrompt: result.imagePrompt,
              }
            : currentDraft
        )
      );
    },
    [setCandidateDrafts]
  );

  const regenerateImageForCandidate = useCallback(
    async (candidateId: string, token: number | null = null) => {
      if (
        activeImageRegenerationCandidateIdRef.current !== null ||
        activeRegenerationCandidateIdRef.current !== null
      ) {
        return;
      }

      const draft = candidateDraftsRef.current.find(
        (candidateDraft) => candidateDraft.candidate.clientId === candidateId
      );
      if (!draft || !draft.imagePrompt.trim()) return;

      activeImageRegenerationCandidateIdRef.current = candidateId;
      setRegeneratingImageCandidateId(candidateId);
      setRegenerateImageErrorByCandidateId((current) =>
        removeErrorForCandidate(current, candidateId)
      );

      try {
        const result = await regenerateCandidateImage.mutateAsync({
          candidate: buildStudyCandidateCommitItem(draft),
          imagePrompt: draft.imagePrompt,
        });

        if (token === null || generationTokenRef.current === token) {
          applyImageResult(candidateId, result);
        }
      } catch (error) {
        if (token === null || generationTokenRef.current === token) {
          setRegenerateImageErrorByCandidateId((current) => ({
            ...current,
            [candidateId]:
              error instanceof Error && error.message
                ? error.message
                : t('create.regenerateImageFailed'),
          }));
        }
      } finally {
        if (activeImageRegenerationCandidateIdRef.current === candidateId) {
          activeImageRegenerationCandidateIdRef.current = null;
        }
        setRegeneratingImageCandidateId((current) => (current === candidateId ? null : current));
      }
    },
    [applyImageResult, regenerateCandidateImage, t]
  );

  const startLazyImageBackfill = useCallback(
    async (drafts: StudyCandidateDraft[], token: number) => {
      const visualDraftIds = drafts
        .filter(
          (draft) =>
            hasVisualProductionPreview(draft) && draft.imagePrompt.trim() && !draft.previewImage
        )
        .slice(0, STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT)
        .map((draft) => draft.candidate.clientId);

      await visualDraftIds.reduce<Promise<void>>(async (previous, candidateId) => {
        await previous;
        if (generationTokenRef.current !== token) return;
        // This lazy queue intentionally yields if the user starts another candidate
        // regeneration; avoiding concurrent provider calls is more important than
        // forcing every automatic image backfill to drain.
        await regenerateImageForCandidate(candidateId, token);
      }, Promise.resolve());
    },
    [regenerateImageForCandidate]
  );

  const clearGeneratedState = useCallback(
    (options: { skipTokenIncrement?: boolean } = {}) => {
      if (!options.skipTokenIncrement) {
        generationTokenRef.current += 1;
      }

      activeRegenerationCandidateIdRef.current = null;
      activeImageRegenerationCandidateIdRef.current = null;
      setLearnerContextSummary(null);
      setCandidateDrafts([]);
      setRegeneratingCandidateId(null);
      setRegeneratingImageCandidateId(null);
      setRegenerateErrorByCandidateId({});
      setRegenerateImageErrorByCandidateId({});
      setPreviewDraftIndex(null);
    },
    [setCandidateDrafts]
  );

  const generate = useCallback(
    async (payload: StudyCardCandidateGenerateRequest) => {
      setSuccess(null);
      const token = generationTokenRef.current + 1;
      generationTokenRef.current = token;
      // This generate call has already advanced the token above; clearing state here should
      // not advance it again or the upcoming response would look stale to itself.
      clearGeneratedState({ skipTokenIncrement: true });

      const result = await generateCandidates.mutateAsync(payload);
      if (generationTokenRef.current !== token) return;

      const nextDrafts = result.candidates.map(createStudyCandidateDraft);
      // Keep the ref in step with the freshly generated drafts before React commits state,
      // because lazy image backfill may read it immediately after generation resolves.
      candidateDraftsRef.current = nextDrafts;
      setLearnerContextSummary(result.learnerContextSummary ?? null);
      setCandidateDrafts(nextDrafts);
      startLazyImageBackfill(nextDrafts, token).catch(() => undefined);
    },
    [clearGeneratedState, generateCandidates, setCandidateDrafts, startLazyImageBackfill]
  );

  const updateCandidateField = useCallback(
    <K extends keyof StudyCardFormValues>(
      index: number,
      field: K,
      value: StudyCardFormValues[K]
    ) => {
      setCandidateDrafts((current) =>
        current.map((draft, draftIndex) => {
          if (draftIndex !== index) return draft;
          return {
            ...draft,
            values: {
              ...draft.values,
              [field]: value,
            },
            previewAudio: STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS.has(field)
              ? null
              : draft.previewAudio,
          };
        })
      );
    },
    [setCandidateDrafts]
  );

  const updateCandidateImagePrompt = useCallback(
    (index: number, value: string) => {
      setCandidateDrafts((current) =>
        current.map((draft, draftIndex) =>
          // Keep the existing image preview while the prompt is edited; the new prompt
          // takes effect only when the user explicitly regenerates the image.
          draftIndex === index ? { ...draft, imagePrompt: value } : draft
        )
      );
    },
    [setCandidateDrafts]
  );

  const toggleCandidate = useCallback(
    (index: number) => {
      setCandidateDrafts((current) =>
        current.map((draft, draftIndex) =>
          draftIndex === index ? { ...draft, selected: !draft.selected } : draft
        )
      );
    },
    [setCandidateDrafts]
  );

  const handleRegenerateCandidateAudio = useCallback(
    async (index: number) => {
      setSuccess(null);
      const draft = candidateDraftsRef.current[index];
      if (!draft) return;

      const candidateId = draft.candidate.clientId;
      if (
        activeRegenerationCandidateIdRef.current !== null ||
        activeImageRegenerationCandidateIdRef.current !== null
      ) {
        return;
      }

      activeRegenerationCandidateIdRef.current = candidateId;
      setRegeneratingCandidateId(candidateId);
      setRegenerateErrorByCandidateId((current) => removeErrorForCandidate(current, candidateId));

      try {
        const result = await regenerateCandidateAudio.mutateAsync({
          candidate: buildStudyCandidateCommitItem(draft),
        });

        setCandidateDrafts((current) =>
          // If a newer generation replaced the draft list while this request was in flight,
          // the old clientId will not match anything and the stale audio result is dropped.
          current.map((currentDraft) =>
            currentDraft.candidate.clientId === candidateId
              ? {
                  ...currentDraft,
                  candidate: {
                    ...currentDraft.candidate,
                    prompt: result.prompt,
                    answer: result.answer,
                    previewAudio: result.previewAudio,
                    previewAudioRole: result.previewAudioRole,
                  },
                  previewAudio: result.previewAudio,
                  previewAudioRole: result.previewAudioRole,
                }
              : currentDraft
          )
        );
      } catch (error) {
        setRegenerateErrorByCandidateId((current) => ({
          ...current,
          [candidateId]:
            error instanceof Error && error.message
              ? error.message
              : t('create.regeneratePreviewFailed'),
        }));
      } finally {
        if (activeRegenerationCandidateIdRef.current === candidateId) {
          activeRegenerationCandidateIdRef.current = null;
        }
        setRegeneratingCandidateId((current) => (current === candidateId ? null : current));
      }
    },
    [regenerateCandidateAudio, setCandidateDrafts, t]
  );

  const handleRegenerateCandidateImage = useCallback(
    async (index: number) => {
      setSuccess(null);
      const draft = candidateDraftsRef.current[index];
      if (!draft) return;
      await regenerateImageForCandidate(draft.candidate.clientId);
    },
    [regenerateImageForCandidate]
  );

  const commit = useCallback(async () => {
    setSuccess(null);
    const selectedCandidates = candidateDraftsRef.current.filter((draft) => draft.selected);
    const result = await commitCandidates.mutateAsync({
      candidates: selectedCandidates.map((draft) => buildStudyCandidateCommitItem(draft)),
    });

    setSuccess(t('create.generatedSuccess', { count: result.cards.length }));
    generationTokenRef.current += 1;
    activeRegenerationCandidateIdRef.current = null;
    activeImageRegenerationCandidateIdRef.current = null;
    setCandidateDrafts([]);
    setRegeneratingCandidateId(null);
    setRegeneratingImageCandidateId(null);
    setRegenerateErrorByCandidateId({});
    setRegenerateImageErrorByCandidateId({});
    setPreviewDraftIndex(null);
  }, [commitCandidates, setCandidateDrafts, t]);

  return {
    candidateDrafts,
    clearGeneratedState,
    commit,
    commitCandidates,
    generate,
    generateCandidates,
    handleRegenerateCandidateAudio,
    handleRegenerateCandidateImage,
    isCandidateAudioRegenerating,
    isCandidateImageRegenerating,
    learnerContextSummary,
    previewDraftIndex,
    regenerateErrorByCandidateId,
    regenerateImageErrorByCandidateId,
    regeneratingCandidateId,
    regeneratingImageCandidateId,
    selectedCount,
    setPreviewDraftIndex,
    setSuccess,
    success,
    toggleCandidate,
    updateCandidateField,
    updateCandidateImagePrompt,
  };
}

export default useGeneratedStudyCandidates;
