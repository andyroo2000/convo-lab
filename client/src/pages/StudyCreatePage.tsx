import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyManualCardDraft,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import StudyManualDraftComposerPanel from '../components/study/StudyManualDraftComposerPanel';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
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
import useEffectiveUser from '../hooks/useEffectiveUser';
import { useAutomaticStudyActivity } from '../hooks/useStudyActivity';
import useStudyDraftAutosaveQueue from '../hooks/useStudyDraftAutosaveQueue';
import useStudyCreateActionGuard from '../hooks/useStudyCreateActionGuard';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';
import {
  clearStudyDraftIntent,
  isStudyDraftIntentApplied,
  isStudyDraftIntentStorageKeyForOwner,
  readStudyDraftIntent,
  removeStudyDraftIntent,
  type StudyDraftIntent,
} from '../lib/studyDraftIntentStore';
import StudyDraftRevisionConflictError from '../lib/studyDraftRevisionConflict';

type CreateMode = 'generate' | 'manual';
type StudyDraftRecovery = { intent: StudyDraftIntent; serverDraft: StudyManualCardDraft };
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
  const { effectiveUser, isImpersonating } = useEffectiveUser();
  // Learning OS Study routes are scoped to the authenticated session and do not support
  // ConvoLab's viewAs query parameter. Keep both remote drafts and durable local intents
  // disabled while an admin is viewing another user.
  const draftIntentOwnerId = isImpersonating ? null : (effectiveUser?.id ?? null);
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
  const capabilitiesQuery = useStudyCapabilities();
  const cardAuthoringCapabilities = capabilitiesQuery.data?.cardAuthoring;
  const manualDefaultVoiceIds = useMemo(
    () =>
      cardAuthoringCapabilities
        ? [
            cardAuthoringCapabilities.defaultAnswerAudioVoiceId,
            cardAuthoringCapabilities.defaultFemaleAnswerAudioVoiceId,
          ]
        : [],
    [cardAuthoringCapabilities]
  );
  const manualDefaultVoiceId = useMemo(
    () =>
      defaultVoiceIdForStudyCardCreationKind(
        DEFAULT_STUDY_CARD_CREATION_KIND,
        manualDefaultVoiceIds
      ),
    [manualDefaultVoiceIds]
  );
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
  const manualFormBaseRevisionRef = useRef<number | null>(null);
  const replayingIntentIdsRef = useRef(new Set<string>());
  const [draftRecovery, setDraftRecovery] = useState<StudyDraftRecovery | null>(null);
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const [draftStorageVersion, setDraftStorageVersion] = useState(0);
  const showDraftRecovery = useCallback((next: StudyDraftRecovery) => {
    setDraftRecovery((current) =>
      current?.intent.intentId === next.intent.intentId &&
      current.serverDraft.revision === next.serverDraft.revision
        ? current
        : next
    );
  }, []);
  const runManualAction = useStudyCreateActionGuard();
  const runVocabGeneration = useStudyCreateActionGuard();
  const manualDraftsQuery = useStudyManualCardDrafts(draftIntentOwnerId);
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
  const selectedManualDraft = useMemo(
    () => manualDrafts.find((draft) => draft.id === selectedManualDraftId) ?? null,
    [manualDrafts, selectedManualDraftId]
  );
  const { values, setField, setValues } = useStudyCardForm({
    initialCardType: 'recognition',
  });
  useEffect(() => {
    if (!manualDefaultVoiceId) return;
    setValues((current) =>
      current.answerAudioVoiceId
        ? current
        : { ...current, answerAudioVoiceId: manualDefaultVoiceId }
    );
  }, [manualDefaultVoiceId, setValues]);
  const {
    cancelScheduledSave: cancelManualDraftAutosave,
    flushSave: flushManualDraftAutosave,
    flushScheduledSave: flushScheduledManualDraftAutosave,
    isSessionIntent: isManualDraftSessionIntent,
    replayIntent: replayManualDraftIntent,
    scheduleSave: scheduleManualDraftAutosave,
    waitForIdle: waitForManualDraftAutosave,
  } = useStudyDraftAutosaveQueue(updateDraft.mutateAsync, {
    onConflict: (intent, error) => {
      replayingIntentIdsRef.current.delete(intent.intentId);
      showDraftRecovery({ intent, serverDraft: error.draft });
    },
    onSaved: (intent, draft) => {
      replayingIntentIdsRef.current.delete(intent.intentId);
      if (selectedManualDraftIdRef.current === draft.id) {
        manualFormBaseRevisionRef.current = draft.revision;
      }
      setDraftRecovery((current) =>
        current?.intent.intentId === intent.intentId ? null : current
      );
    },
    onStorageError: () => setDraftStorageError(t('create.draftStorageFailed')),
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
    revision: 0,
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
      const nextDefaultVoiceId = defaultVoiceIdForStudyCardCreationKind(
        nextCreationKind,
        manualDefaultVoiceIds
      );
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
    [creationKind, manualDefaultVoiceIds, setValues]
  );

  useEffect(() => {
    if (!selectedManualDraftId) return;
    if (manualDrafts.some((draft) => draft.id === selectedManualDraftId)) return;
    setSelectedManualDraftId(null);
    resetManualComposer();
  }, [manualDrafts, resetManualComposer, selectedManualDraftId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        draftIntentOwnerId &&
        isStudyDraftIntentStorageKeyForOwner(event.key, draftIntentOwnerId)
      ) {
        setDraftStorageVersion((current) => current + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [draftIntentOwnerId]);

  useEffect(() => {
    if (!selectedManualDraft) {
      hydratedManualDraftKeyRef.current = null;
      manualFormBaseRevisionRef.current = null;
      setDraftRecovery(null);
      return;
    }

    const hydrationKey = `${selectedManualDraft.id}:${
      selectedManualDraft.status === 'generating' ? 'generating' : 'editable'
    }`;
    if (hydratedManualDraftKeyRef.current === hydrationKey) return;
    hydratedManualDraftKeyRef.current = hydrationKey;

    let persistedIntent: StudyDraftIntent | null = null;
    if (draftIntentOwnerId) {
      try {
        persistedIntent = readStudyDraftIntent(draftIntentOwnerId, selectedManualDraft.id);
      } catch {
        setDraftStorageError(t('create.draftStorageFailed'));
      }
    }
    if (
      persistedIntent &&
      persistedIntent.baseRevision !== selectedManualDraft.revision &&
      !isStudyDraftIntentApplied(persistedIntent, selectedManualDraft)
    ) {
      showDraftRecovery({ intent: persistedIntent, serverDraft: selectedManualDraft });
    }
    const draftForHydration =
      persistedIntent && persistedIntent.baseRevision === selectedManualDraft.revision
        ? { ...selectedManualDraft, ...persistedIntent.values }
        : selectedManualDraft;

    manualFormBaseRevisionRef.current = selectedManualDraft.revision;
    setCreationKind(draftForHydration.creationKind);
    setValues(getDraftFormValues(draftForHydration));
    setManualImagePrompt(draftForHydration.imagePrompt ?? '');
    setManualImagePlacement(draftForHydration.imagePlacement);
    setManualPreviewImage(draftForHydration.previewImage);
    setManualPreviewAudio(draftForHydration.previewAudio);
    setManualPreviewAudioRole(draftForHydration.previewAudioRole);
    setManualSuccess(null);
    setIsManualPreviewOpen(false);
  }, [draftIntentOwnerId, selectedManualDraft, setValues, showDraftRecovery, t]);

  useEffect(() => {
    manualDrafts.forEach((draft) => {
      if (!draftIntentOwnerId) return;
      let intent: StudyDraftIntent | null = null;
      try {
        intent = readStudyDraftIntent(draftIntentOwnerId, draft.id);
      } catch {
        setDraftStorageError(t('create.draftStorageFailed'));
        return;
      }
      if (!intent) return;
      if (isManualDraftSessionIntent(intent)) return;

      if (isStudyDraftIntentApplied(intent, draft)) {
        clearStudyDraftIntent(intent);
        setDraftRecovery((current) =>
          current?.intent.intentId === intent.intentId ? null : current
        );
        return;
      }

      if (draft.revision !== intent.baseRevision) {
        if (selectedManualDraftIdRef.current === draft.id) {
          showDraftRecovery({ intent, serverDraft: draft });
        }
        return;
      }

      if (replayingIntentIdsRef.current.has(intent.intentId)) return;
      replayingIntentIdsRef.current.add(intent.intentId);
      replayManualDraftIntent(intent).catch(() => {
        replayingIntentIdsRef.current.delete(intent.intentId);
      });
    });
  }, [
    draftIntentOwnerId,
    draftStorageVersion,
    isManualDraftSessionIntent,
    manualDrafts,
    replayManualDraftIntent,
    showDraftRecovery,
    t,
  ]);

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

    if (!draftIntentOwnerId) return undefined;
    let persistedIntent: StudyDraftIntent | null = null;
    try {
      persistedIntent = readStudyDraftIntent(draftIntentOwnerId, selectedManualDraft.id);
    } catch {
      setDraftStorageError(t('create.draftStorageFailed'));
      return undefined;
    }
    if (persistedIntent) {
      if (!isManualDraftSessionIntent(persistedIntent)) return undefined;
      if (JSON.stringify(nextPayload) === JSON.stringify(persistedIntent.values)) return undefined;
    }

    scheduleManualDraftAutosave({
      ownerId: draftIntentOwnerId,
      draftId: selectedManualDraft.id,
      baseRevision: manualFormBaseRevisionRef.current ?? selectedManualDraft.revision,
      values: nextPayload,
    });

    return cancelManualDraftAutosave;
  }, [
    cancelManualDraftAutosave,
    draftIntentOwnerId,
    manualImagePlacement,
    manualImagePrompt,
    manualPayload.answer,
    manualPayload.prompt,
    manualPreviewAudio,
    manualPreviewAudioRole,
    manualPreviewImage,
    isManualDraftSessionIntent,
    scheduleManualDraftAutosave,
    selectedManualDraft,
    t,
  ]);

  const handleCreationKindChange = (nextCreationKind: StudyCardCreationKind) => {
    const nextImagePlacement = defaultImagePlacementForStudyCardCreationKind(nextCreationKind);
    setCreationKind(nextCreationKind);
    setValues((current) => ({
      ...current,
      cardType: cardTypeForStudyCardCreationKind(nextCreationKind),
      answerAudioVoiceId: isStudyCardCreationDefaultVoice(
        current.answerAudioVoiceId,
        manualDefaultVoiceIds
      )
        ? defaultVoiceIdForStudyCardCreationKind(nextCreationKind, manualDefaultVoiceIds)
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
      ownerId: draftIntentOwnerId ?? '',
      draftId: selectedManualDraft.id,
      baseRevision: manualFormBaseRevisionRef.current ?? selectedManualDraft.revision,
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
        manualFormBaseRevisionRef.current = result.revision;
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
        manualFormBaseRevisionRef.current = result.revision;
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
        if (draftIntentOwnerId) removeStudyDraftIntent(draftIntentOwnerId, draftId);
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
        if (draftIntentOwnerId) removeStudyDraftIntent(draftIntentOwnerId, draftId);
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
  if (draftStorageError) {
    manualErrorMessage = draftStorageError;
  } else if (manualError instanceof StudyDraftRevisionConflictError) {
    manualErrorMessage = null;
  } else if (manualError instanceof Error) {
    manualErrorMessage = manualError.message;
  } else if (manualError) {
    manualErrorMessage = t('create.failed');
  }
  if (isImpersonating) {
    return (
      <section className="card app-surface max-w-4xl" role="status">
        <h1 className="mb-3 text-3xl font-bold text-navy">{t('create.title')}</h1>
        <p className="text-gray-600">{t('create.impersonationUnavailable')}</p>
      </section>
    );
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
    <div className="ios-create-page space-y-6">
      <section className="card app-surface max-w-4xl">
        <h1 className="mb-3 text-3xl font-bold text-navy">{t('create.title')}</h1>
        <p className="text-gray-600">{t('create.description')}</p>
        <div
          className="app-segmented-control mt-5 grid max-w-md grid-cols-2 rounded-xl p-1"
          role="group"
          aria-label={t('create.title')}
        >
          {(['generate', 'manual'] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              aria-pressed={mode === nextMode}
              onClick={() => {
                setMode(nextMode);
                setManualSuccess(null);
                setVocabSuccess(null);
              }}
              className={`px-4 py-2 text-sm font-semibold transition ${
                mode === nextMode ? 'bg-white text-navy shadow-sm' : 'text-navy/55 hover:text-navy'
              }`}
            >
              {t(`create.${nextMode}`)}
            </button>
          ))}
        </div>
      </section>

      <StudyCapabilitiesError
        isError={capabilitiesQuery.isError}
        isRetrying={capabilitiesQuery.isFetching}
        onRetry={() => {
          capabilitiesQuery.refetch().catch(() => undefined);
        }}
      />

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
          <div className="min-w-0 xl:order-2">
            <StudyManualDraftComposerPanel
              audioError={
                regenerateManualAudio.error instanceof Error
                  ? regenerateManualAudio.error.message
                  : null
              }
              canRetryDraft={canRetrySelectedManualDraft}
              draftRecovery={
                draftRecovery?.intent.draftId === selectedManualDraftId ? draftRecovery : null
              }
              creationKind={creationKind}
              draft={selectedManualDraft}
              errorMessage={manualErrorMessage}
              imageError={
                generateDraftImage.error instanceof Error ? generateDraftImage.error.message : null
              }
              imagePlacement={manualImagePlacement}
              imagePrompt={manualImagePrompt}
              imagePromptMaxLength={cardAuthoringCapabilities?.limits.imagePromptCharacters}
              isActionBusy={isManualActionBusy}
              isCreatingCard={createCardFromDraft.isPending}
              isCreatingDraft={createDraft.isPending}
              isDeletingDraft={deleteDraft.isPending}
              isGeneratingImage={generateDraftImage.isPending}
              isPreviewOpen={isManualPreviewOpen}
              isRegeneratingAudio={regenerateManualAudio.isPending}
              isRetryingDraft={retryDraft.isPending}
              onCreationKindChange={handleCreationKindChange}
              onDiscardRecoveredDraft={() => {
                if (!draftRecovery) return;
                clearStudyDraftIntent(draftRecovery.intent);
                manualFormBaseRevisionRef.current = draftRecovery.serverDraft.revision;
                setValues(getDraftFormValues(draftRecovery.serverDraft));
                setManualImagePrompt(draftRecovery.serverDraft.imagePrompt ?? '');
                setManualImagePlacement(draftRecovery.serverDraft.imagePlacement);
                setManualPreviewImage(draftRecovery.serverDraft.previewImage);
                setManualPreviewAudio(draftRecovery.serverDraft.previewAudio);
                setManualPreviewAudioRole(draftRecovery.serverDraft.previewAudioRole);
                setDraftRecovery(null);
              }}
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
              onRestoreRecoveredDraft={() => {
                if (!draftRecovery) return;
                const restoredDraft = {
                  ...draftRecovery.serverDraft,
                  ...draftRecovery.intent.values,
                };
                manualFormBaseRevisionRef.current = draftRecovery.serverDraft.revision;
                setValues(getDraftFormValues(restoredDraft));
                setManualImagePrompt(restoredDraft.imagePrompt ?? '');
                setManualImagePlacement(restoredDraft.imagePlacement);
                setManualPreviewImage(restoredDraft.previewImage);
                setManualPreviewAudio(restoredDraft.previewAudio);
                setManualPreviewAudioRole(restoredDraft.previewAudioRole);
                setDraftRecovery(null);
                replayManualDraftIntent(
                  draftRecovery.intent,
                  draftRecovery.serverDraft.revision
                ).catch(() => undefined);
              }}
              onSubmit={handleManualSubmit}
              previewAudioRole={manualPreviewAudioRole}
              previewAudioUrl={manualPreviewAudioUrl}
              previewCard={manualPreviewCard}
              previewImageUrl={manualPreviewImageUrl}
              successMessage={manualSuccess}
              values={values}
            />
          </div>
          <div className="min-w-0 xl:order-1">{draftListPanel}</div>
        </section>
      )}
    </div>
  );
};

export default StudyCreatePage;
