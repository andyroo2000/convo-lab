import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { selectManualStudyCardDefaultVoiceId } from '@languageflow/shared/src/constants-new';
import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyManualCardDraft,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import StudyManualDraftComposerPanel from '../components/study/StudyManualDraftComposerPanel';
import StudyManualDraftListPanel from '../components/study/StudyManualDraftListPanel';
import StudyVocabDraftGeneratorPanel from '../components/study/StudyVocabDraftGeneratorPanel';
import {
  buildStudyCardFormPayload,
  getStudyCardFormValues,
  type StudyCardFormValues,
  useStudyCardForm,
} from '../components/study/studyCardFormModel';
import {
  applyStudyCardImageToPayload,
  cardTypeForStudyCardCreationKind,
  DEFAULT_STUDY_CARD_CREATION_KIND,
  defaultImagePlacementForStudyCardCreationKind,
  defaultVoiceIdForStudyCardCreationKind,
  isStudyCardCreationDefaultVoice,
} from '../components/study/studyCardCreationModel';
import { toAssetUrl } from '../components/study/studyCardUtils';
import {
  useCreateCardFromStudyManualCardDraft,
  useCreateStudyManualCardDraft,
  useCreateStudyVocabBundleDrafts,
  useDeleteStudyManualCardDraft,
  useGenerateStudyManualCardDraftPreviewAudio,
  useGenerateStudyManualCardDraftPreviewImage,
  useRetryStudyManualCardDraft,
  useStudyManualCardDrafts,
  useUpdateStudyManualCardDraft,
} from '../hooks/useStudy';
import { useStudyActivityActions } from '../contexts/StudyActivityContext';
import { useAutomaticStudyActivity } from '../hooks/useStudyActivity';
import useStudyDraftAutosaveQueue from '../hooks/useStudyDraftAutosaveQueue';
import useStudyCreateActionGuard from '../hooks/useStudyCreateActionGuard';

type CreateMode = 'generate' | 'manual';
const STALE_GENERATING_DRAFT_RETRY_AFTER_MS = 10 * 60 * 1000;
const STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS = new Set<keyof StudyCardFormValues>([
  'answerExpression',
  'answerReading',
  'answerAudioVoiceId',
  'answerAudioTextOverride',
]);

function getDraftFormValues(result: StudyManualCardDraft) {
  return getStudyCardFormValues({
    card: {
      id: 'manual-draft',
      noteId: 'manual-draft-note',
      cardType: result.cardType,
      prompt: result.prompt,
      answer: result.answer,
      state: {
        dueAt: null,
        introducedAt: null,
        queueState: 'new',
        scheduler: null,
        source: {},
      },
      answerAudioSource: 'missing',
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
    },
  });
}

function isStaleGeneratingManualDraft(draft: StudyManualCardDraft | null | undefined) {
  if (!draft || draft.status !== 'generating') return false;
  return Date.now() - new Date(draft.updatedAt).getTime() >= STALE_GENERATING_DRAFT_RETRY_AFTER_MS;
}

function applyStudyCardAudioToPayload(
  payload: ReturnType<typeof buildStudyCardFormPayload>,
  previewAudio: StudyMediaRef | null,
  previewAudioRole: 'prompt' | 'answer' | null
) {
  if (!previewAudio || !previewAudioRole) return payload;

  if (previewAudioRole === 'prompt') {
    return {
      ...payload,
      prompt: { ...payload.prompt, cueAudio: previewAudio },
      answer: { ...payload.answer, answerAudio: previewAudio },
    };
  }

  return {
    ...payload,
    answer: { ...payload.answer, answerAudio: previewAudio },
  };
}

function buildManualPayloadForCreationKind(input: {
  values: ReturnType<typeof getStudyCardFormValues>;
  creationKind: StudyCardCreationKind;
  cardType: ReturnType<typeof cardTypeForStudyCardCreationKind>;
}) {
  const payload = buildStudyCardFormPayload({
    ...input.values,
    cardType: input.cardType,
  });
  if (input.creationKind !== 'audio-recognition') {
    return payload;
  }

  return {
    ...payload,
    prompt: {},
  };
}

const StudyCreatePage = () => {
  const { t } = useTranslation('study');
  const createDraft = useCreateStudyManualCardDraft();
  const updateDraft = useUpdateStudyManualCardDraft();
  const deleteDraft = useDeleteStudyManualCardDraft();
  const retryDraft = useRetryStudyManualCardDraft();
  const createCardFromDraft = useCreateCardFromStudyManualCardDraft();
  const createVocabBundleDrafts = useCreateStudyVocabBundleDrafts();
  const { start: startActivity, stop: stopActivity, addCreatedCards } = useStudyActivityActions();
  const startCreationTimer = useCallback(
    () =>
      startActivity({
        category: 'create',
        activity: 'card_creation',
        source: 'automatic',
        name: 'Card creator',
      }),
    [startActivity]
  );
  const stopCreationTimer = useCallback(() => stopActivity('card_creation'), [stopActivity]);
  useAutomaticStudyActivity(true, startCreationTimer, stopCreationTimer);
  const generateDraftImage = useGenerateStudyManualCardDraftPreviewImage();
  const regenerateManualAudio = useGenerateStudyManualCardDraftPreviewAudio();
  const [manualDefaultVoiceId] = useState(() => selectManualStudyCardDefaultVoiceId());
  const [mode, setMode] = useState<CreateMode>('generate');
  const [creationKind, setCreationKind] = useState<StudyCardCreationKind>(
    DEFAULT_STUDY_CARD_CREATION_KIND
  );
  const [targetWord, setTargetWord] = useState('');
  const [sourceSentence, setSourceSentence] = useState('');
  const [context, setContext] = useState('');
  const [includeLearnerContext, setIncludeLearnerContext] = useState(true);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [vocabSuccess, setVocabSuccess] = useState<string | null>(null);
  const [manualImagePrompt, setManualImagePrompt] = useState('');
  const [manualImagePlacement, setManualImagePlacement] = useState<StudyCardImagePlacement>(() =>
    defaultImagePlacementForStudyCardCreationKind(DEFAULT_STUDY_CARD_CREATION_KIND)
  );
  const [manualPreviewImage, setManualPreviewImage] = useState<StudyMediaRef | null>(null);
  const [manualPreviewAudio, setManualPreviewAudio] = useState<StudyMediaRef | null>(null);
  const [manualPreviewAudioRole, setManualPreviewAudioRole] = useState<'prompt' | 'answer' | null>(
    null
  );
  const [isManualPreviewOpen, setIsManualPreviewOpen] = useState(false);
  const [selectedManualDraftId, setSelectedManualDraftId] = useState<string | null>(null);
  const selectedManualDraftIdRef = useRef(selectedManualDraftId);
  selectedManualDraftIdRef.current = selectedManualDraftId;
  const hydratedManualDraftKeyRef = useRef<string | null>(null);
  const runManualAction = useStudyCreateActionGuard();
  const runVocabGeneration = useStudyCreateActionGuard();
  const manualDraftsQuery = useStudyManualCardDrafts(true);
  const { data: manualDraftData } = manualDraftsQuery;
  const manualDraftPages = useMemo(() => {
    if (!manualDraftData) return [];
    return 'pages' in manualDraftData ? manualDraftData.pages : [manualDraftData];
  }, [manualDraftData]);
  const manualDrafts = useMemo(
    () => manualDraftPages.flatMap((page) => page.drafts),
    [manualDraftPages]
  );
  const manualDraftTotal = manualDraftPages[0]?.total ?? manualDrafts.length;
  const {
    cancelScheduledSave: cancelManualDraftAutosave,
    flushSave: flushManualDraftAutosave,
    flushScheduledSave: flushScheduledManualDraftAutosave,
    scheduleSave: scheduleManualDraftAutosave,
    waitForIdle: waitForManualDraftAutosave,
  } = useStudyDraftAutosaveQueue(updateDraft.mutateAsync);
  const selectedManualDraft = useMemo(
    () => manualDrafts.find((draft) => draft.id === selectedManualDraftId) ?? null,
    [manualDrafts, selectedManualDraftId]
  );
  const { values, setField, setValues } = useStudyCardForm({
    initialCardType: 'recognition',
    initialAnswerAudioVoiceId: manualDefaultVoiceId,
  });
  const manualCardType = cardTypeForStudyCardCreationKind(creationKind);
  const manualPayloadWithoutMedia = buildManualPayloadForCreationKind({
    values,
    creationKind,
    cardType: manualCardType,
  });
  const manualPayloadWithImage = applyStudyCardImageToPayload(
    manualPayloadWithoutMedia,
    manualPreviewImage,
    manualImagePlacement
  );
  const manualPayload = applyStudyCardAudioToPayload(
    manualPayloadWithImage,
    manualPreviewAudio,
    manualPreviewAudioRole
  );
  const manualPreviewImageUrl = toAssetUrl(manualPreviewImage?.url);
  const manualPreviewAudioUrl = toAssetUrl(manualPreviewAudio?.url);
  const manualPreviewCard: StudyCardSummary = {
    id: 'manual-preview',
    noteId: 'manual-preview-note',
    ...manualPayload,
    state: {
      dueAt: null,
      introducedAt: null,
      queueState: 'new',
      scheduler: null,
      source: {},
    },
    answerAudioSource: 'missing',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  const canRetrySelectedManualDraft =
    selectedManualDraft?.status === 'error' || isStaleGeneratingManualDraft(selectedManualDraft);
  const isManualActionBusy =
    createDraft.isPending ||
    deleteDraft.isPending ||
    retryDraft.isPending ||
    createCardFromDraft.isPending ||
    generateDraftImage.isPending ||
    regenerateManualAudio.isPending;

  const resetManualComposer = useCallback(
    (nextCreationKind = creationKind) => {
      const nextDefaultVoiceId = selectManualStudyCardDefaultVoiceId();
      setValues(
        getStudyCardFormValues({
          initialCardType: cardTypeForStudyCardCreationKind(nextCreationKind),
          initialAnswerAudioVoiceId: nextDefaultVoiceId,
        })
      );
      setManualImagePrompt('');
      setManualImagePlacement(defaultImagePlacementForStudyCardCreationKind(nextCreationKind));
      setManualPreviewImage(null);
      setManualPreviewAudio(null);
      setManualPreviewAudioRole(null);
      setIsManualPreviewOpen(false);
    },
    [creationKind, setValues]
  );

  useEffect(() => {
    if (!selectedManualDraftId) return;
    if (manualDrafts.some((draft) => draft.id === selectedManualDraftId)) return;
    setSelectedManualDraftId(null);
    resetManualComposer();
  }, [manualDrafts, resetManualComposer, selectedManualDraftId]);

  useEffect(() => {
    if (!selectedManualDraft) {
      hydratedManualDraftKeyRef.current = null;
      return;
    }

    const hydrationKey = `${selectedManualDraft.id}:${
      selectedManualDraft.status === 'generating' ? 'generating' : 'editable'
    }`;
    if (hydratedManualDraftKeyRef.current === hydrationKey) return;
    hydratedManualDraftKeyRef.current = hydrationKey;

    setCreationKind(selectedManualDraft.creationKind);
    setValues(getDraftFormValues(selectedManualDraft));
    setManualImagePrompt(selectedManualDraft.imagePrompt ?? '');
    setManualImagePlacement(selectedManualDraft.imagePlacement);
    setManualPreviewImage(selectedManualDraft.previewImage);
    setManualPreviewAudio(selectedManualDraft.previewAudio);
    setManualPreviewAudioRole(selectedManualDraft.previewAudioRole);
    setManualSuccess(null);
    setIsManualPreviewOpen(false);
  }, [selectedManualDraft, setValues]);

  useEffect(() => {
    if (
      !selectedManualDraft ||
      selectedManualDraft.status === 'generating' ||
      selectedManualDraft.committedCardId
    ) {
      return undefined;
    }

    const nextPayload = {
      prompt: manualPayload.prompt,
      answer: manualPayload.answer,
      imagePlacement: manualImagePlacement,
      imagePrompt: manualImagePrompt.trim() || null,
      previewAudio: manualPreviewAudio,
      previewAudioRole: manualPreviewAudioRole,
      previewImage: manualPreviewImage,
    };
    const persistedPayload = {
      prompt: selectedManualDraft.prompt,
      answer: selectedManualDraft.answer,
      imagePlacement: selectedManualDraft.imagePlacement,
      imagePrompt: selectedManualDraft.imagePrompt,
      previewAudio: selectedManualDraft.previewAudio,
      previewAudioRole: selectedManualDraft.previewAudioRole,
      previewImage: selectedManualDraft.previewImage,
    };

    if (JSON.stringify(nextPayload) === JSON.stringify(persistedPayload)) {
      return undefined;
    }

    scheduleManualDraftAutosave({
      draftId: selectedManualDraft.id,
      values: nextPayload,
    });

    return cancelManualDraftAutosave;
  }, [
    cancelManualDraftAutosave,
    manualImagePlacement,
    manualImagePrompt,
    manualPayload.answer,
    manualPayload.prompt,
    manualPreviewAudio,
    manualPreviewAudioRole,
    manualPreviewImage,
    scheduleManualDraftAutosave,
    selectedManualDraft,
  ]);

  const handleCreationKindChange = (nextCreationKind: StudyCardCreationKind) => {
    const nextImagePlacement = defaultImagePlacementForStudyCardCreationKind(nextCreationKind);
    setCreationKind(nextCreationKind);
    setValues((current) => ({
      ...current,
      cardType: cardTypeForStudyCardCreationKind(nextCreationKind),
      answerAudioVoiceId: isStudyCardCreationDefaultVoice(current.answerAudioVoiceId)
        ? defaultVoiceIdForStudyCardCreationKind(nextCreationKind)
        : current.answerAudioVoiceId,
    }));
    setManualPreviewAudio(null);
    setManualPreviewAudioRole(null);
    setManualSuccess(null);
    setManualImagePlacement(nextImagePlacement);
    if (nextImagePlacement === 'none') {
      setManualImagePrompt('');
      setManualPreviewImage(null);
    } else if (manualImagePlacement !== nextImagePlacement) {
      setManualImagePrompt('');
      setManualPreviewImage(null);
    }
  };

  const handleManualFieldChange = <K extends keyof typeof values>(
    field: K,
    value: (typeof values)[K]
  ) => {
    setField(field, value);
    if (STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS.has(field)) {
      setManualPreviewAudio(null);
      setManualPreviewAudioRole(null);
    }
  };

  const handleFillRemainingFields = async () => {
    await runManualAction(async () => {
      setManualSuccess(null);
      const selectedDraftIdAtStart = selectedManualDraftIdRef.current;
      try {
        await createDraft.mutateAsync({
          creationKind,
          cardType: manualPayloadWithoutMedia.cardType,
          prompt: manualPayloadWithoutMedia.prompt,
          answer: manualPayloadWithoutMedia.answer,
          imagePlacement: manualImagePlacement,
          imagePrompt: manualImagePrompt.trim() || null,
        });
        if (selectedManualDraftIdRef.current !== selectedDraftIdAtStart) return;
        setSelectedManualDraftId(null);
        resetManualComposer(creationKind);
        setManualSuccess(t('create.draftQueued'));
      } catch {
        // React Query exposes the queue error through createDraft.error.
      }
    });
  };

  const persistSelectedManualDraft = async () => {
    if (!selectedManualDraft) return null;
    await flushManualDraftAutosave({
      draftId: selectedManualDraft.id,
      values: {
        prompt: manualPayload.prompt,
        answer: manualPayload.answer,
        imagePlacement: manualImagePlacement,
        imagePrompt: manualImagePrompt.trim() || null,
        previewAudio: manualPreviewAudio,
        previewAudioRole: manualPreviewAudioRole,
        previewImage: manualPreviewImage,
      },
    });

    return selectedManualDraft.id;
  };

  const handleRegenerateManualAudio = async () => {
    await runManualAction(async () => {
      setManualSuccess(null);
      try {
        const draftId = await persistSelectedManualDraft();
        if (!draftId) return;
        const result = await regenerateManualAudio.mutateAsync(draftId);
        if (selectedManualDraftIdRef.current !== draftId) return;
        setManualPreviewAudio(result.previewAudio);
        setManualPreviewAudioRole(result.previewAudioRole);
      } catch {
        // React Query exposes the regeneration error through regenerateManualAudio.error.
      }
    });
  };

  const handleGenerateManualImage = async () => {
    await runManualAction(async () => {
      setManualSuccess(null);
      try {
        const draftId = await persistSelectedManualDraft();
        if (!draftId) return;
        const result = await generateDraftImage.mutateAsync(draftId);
        if (selectedManualDraftIdRef.current !== draftId) return;
        setManualImagePrompt(result.imagePrompt);
        setManualImagePlacement(result.imagePlacement);
        setManualPreviewImage(result.previewImage);
      } catch {
        // React Query exposes the image-generation error through generateDraftImage.error.
      }
    });
  };

  const handleRetrySelectedDraft = async () => {
    if (!selectedManualDraft) return;
    await runManualAction(async () => {
      const draftId = selectedManualDraft.id;
      setManualSuccess(null);
      try {
        if (selectedManualDraft.status === 'generating') {
          cancelManualDraftAutosave();
          await waitForManualDraftAutosave();
        } else {
          await persistSelectedManualDraft();
        }
        if (selectedManualDraftIdRef.current !== draftId) return;
        await retryDraft.mutateAsync(draftId);
      } catch {
        // React Query exposes the retry error through retryDraft.error.
      }
    });
  };

  const handleDeleteSelectedDraft = async () => {
    if (!selectedManualDraft) return;
    await runManualAction(async () => {
      const draftId = selectedManualDraft.id;
      setManualSuccess(null);
      try {
        cancelManualDraftAutosave();
        await waitForManualDraftAutosave();
        await deleteDraft.mutateAsync(draftId);
        if (selectedManualDraftIdRef.current !== draftId) return;
        setSelectedManualDraftId(null);
        resetManualComposer(creationKind);
        setManualSuccess(t('create.draftDeleted'));
      } catch {
        // React Query exposes the delete error through deleteDraft.error.
      }
    });
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedManualDraft) return;
    await runManualAction(async () => {
      const draftId = selectedManualDraft.id;
      setManualSuccess(null);

      try {
        const createdDraftIndex = manualDrafts.findIndex(
          (draft) => draft.id === selectedManualDraft.id
        );
        if (!selectedManualDraft.committedCardId) {
          await persistSelectedManualDraft();
        } else {
          cancelManualDraftAutosave();
          await waitForManualDraftAutosave();
        }
        const result = await createCardFromDraft.mutateAsync(selectedManualDraft);
        addCreatedCards();
        if (selectedManualDraftIdRef.current !== draftId) return;
        let nextDraftId: string | null = null;
        if (createdDraftIndex >= 0) {
          nextDraftId =
            manualDrafts[createdDraftIndex + 1]?.id ??
            (createdDraftIndex > 0 ? manualDrafts[createdDraftIndex - 1]?.id : null);
        }

        setManualSuccess(t('create.success', { cardType: result.card.cardType }));
        setSelectedManualDraftId(nextDraftId);
        if (!nextDraftId) {
          resetManualComposer(creationKind);
        }
      } catch {
        // React Query stores the mutation error for the visible form message.
      }
    });
  };

  const handleGenerateSubmit = async () => {
    await runVocabGeneration(async () => {
      setVocabSuccess(null);
      try {
        const result = await createVocabBundleDrafts.mutateAsync({
          targetWord,
          sourceSentence: sourceSentence || null,
          context,
          includeLearnerContext,
        });
        setTargetWord('');
        setSourceSentence('');
        setContext('');
        setVocabSuccess(t('create.generatedSuccess', { count: result.drafts.length }));
      } catch {
        // React Query stores the mutation error for the visible form message.
      }
    });
  };

  const manualError =
    createDraft.error ??
    updateDraft.error ??
    createCardFromDraft.error ??
    deleteDraft.error ??
    retryDraft.error;
  let manualErrorMessage: string | null = null;
  if (manualError instanceof Error) {
    manualErrorMessage = manualError.message;
  } else if (manualError) {
    manualErrorMessage = t('create.failed');
  }
  const draftListPanel = (
    <StudyManualDraftListPanel
      drafts={manualDrafts}
      error={manualDraftsQuery.error}
      hasNextPage={manualDraftsQuery.hasNextPage}
      isFetchNextPageError={manualDraftsQuery.isFetchNextPageError}
      isFetchingNextPage={manualDraftsQuery.isFetchingNextPage}
      isLoading={manualDraftsQuery.isLoading}
      onFetchNextPage={() => {
        manualDraftsQuery.fetchNextPage().catch(() => undefined);
      }}
      onNewDraft={() => {
        flushScheduledManualDraftAutosave()?.catch(() => undefined);
        setSelectedManualDraftId(null);
        resetManualComposer(creationKind);
        setManualSuccess(null);
      }}
      onSelectDraft={(draftId) => {
        flushScheduledManualDraftAutosave()?.catch(() => undefined);
        setMode('manual');
        setSelectedManualDraftId(draftId);
      }}
      selectedDraftId={selectedManualDraftId}
      total={manualDraftTotal}
    />
  );

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-4xl">
        <h1 className="mb-3 text-3xl font-bold text-navy">{t('create.title')}</h1>
        <p className="text-gray-600">{t('create.description')}</p>
        <div className="mt-5 inline-flex rounded-full border border-gray-200 bg-white p-1">
          {(['generate', 'manual'] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              onClick={() => {
                setMode(nextMode);
                setManualSuccess(null);
                setVocabSuccess(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mode === nextMode
                  ? 'bg-navy text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-navy'
              }`}
            >
              {t(`create.${nextMode}`)}
            </button>
          ))}
        </div>
      </section>

      {mode === 'generate' ? (
        <StudyVocabDraftGeneratorPanel
          context={context}
          draftList={draftListPanel}
          error={createVocabBundleDrafts.error}
          includeLearnerContext={includeLearnerContext}
          isGenerating={createVocabBundleDrafts.isPending}
          onContextChange={setContext}
          onIncludeLearnerContextChange={setIncludeLearnerContext}
          onSourceSentenceChange={setSourceSentence}
          onSubmit={() => {
            handleGenerateSubmit().catch(() => undefined);
          }}
          onTargetWordChange={setTargetWord}
          sourceSentence={sourceSentence}
          successMessage={vocabSuccess}
          targetWord={targetWord}
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(22rem,34rem)_minmax(0,1fr)]">
          {draftListPanel}

          <StudyManualDraftComposerPanel
            audioError={
              regenerateManualAudio.error instanceof Error
                ? regenerateManualAudio.error.message
                : null
            }
            canRetryDraft={canRetrySelectedManualDraft}
            creationKind={creationKind}
            draft={selectedManualDraft}
            errorMessage={manualErrorMessage}
            imageError={
              generateDraftImage.error instanceof Error ? generateDraftImage.error.message : null
            }
            imagePlacement={manualImagePlacement}
            imagePrompt={manualImagePrompt}
            isActionBusy={isManualActionBusy}
            isCreatingCard={createCardFromDraft.isPending}
            isCreatingDraft={createDraft.isPending}
            isDeletingDraft={deleteDraft.isPending}
            isGeneratingImage={generateDraftImage.isPending}
            isPreviewOpen={isManualPreviewOpen}
            isRegeneratingAudio={regenerateManualAudio.isPending}
            isRetryingDraft={retryDraft.isPending}
            onCreationKindChange={handleCreationKindChange}
            onDeleteDraft={handleDeleteSelectedDraft}
            onFieldChange={handleManualFieldChange}
            onFillRemainingFields={handleFillRemainingFields}
            onGenerateImage={handleGenerateManualImage}
            onImagePlacementChange={setManualImagePlacement}
            onImagePromptChange={setManualImagePrompt}
            onPreviewClose={() => setIsManualPreviewOpen(false)}
            onPreviewOpen={() => setIsManualPreviewOpen(true)}
            onRegenerateAudio={handleRegenerateManualAudio}
            onRetryDraft={handleRetrySelectedDraft}
            onSubmit={handleManualSubmit}
            previewAudioRole={manualPreviewAudioRole}
            previewAudioUrl={manualPreviewAudioUrl}
            previewCard={manualPreviewCard}
            previewImageUrl={manualPreviewImageUrl}
            successMessage={manualSuccess}
            values={values}
          />
        </section>
      )}
    </div>
  );
};

export default StudyCreatePage;
