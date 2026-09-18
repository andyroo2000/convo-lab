import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { STUDY_BROWSER_PAGE_SIZE_DEFAULT } from '@languageflow/shared/src/studyConstants';
import type {
  StudyAnswerPayload,
  StudyBrowserListResponse,
  StudyCardRegenerateImageRequest,
  StudyPromptPayload,
} from '@languageflow/shared/src/types';

import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import type { StudyBrowserQuery } from '../lib/studyBrowseApi';
import {
  useDeleteStudyCard,
  usePromoteStudyNewCardToFront,
  useRegenerateStudyAnswerAudio,
  useRegenerateStudyCardImage,
  useStudyBrowser,
  useStudyBrowserNoteDetail,
  useStudyCardAction,
  useUpdateStudyCard,
} from './useStudy';
import useStudyBackgroundTask from './useStudyBackgroundTask';

interface SaveSelectedCardPayload {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface RegenerateSelectedAudioPayload {
  answerAudioVoiceId?: string | null;
  answerAudioTextOverride?: string | null;
}

type SetDueOptions = {
  mode?: 'now' | 'tomorrow' | 'custom_date';
  dueAt?: string;
};

function errorMessage(error: unknown, fallback?: string): string | null {
  if (error instanceof Error) return error.message;
  return error ? (fallback ?? null) : null;
}

export default function useStudyBrowseController(enabled: boolean) {
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const regenerateImageMutation = useRegenerateStudyCardImage();
  const cardActionMutation = useStudyCardAction();
  const promoteNewCardMutation = usePromoteStudyNewCardToFront();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<StudyBrowserQuery>({
    limit: STUDY_BROWSER_PAGE_SIZE_DEFAULT,
    sortField: 'created_on',
    sortDirection: 'desc',
  });
  const browserQuery = useStudyBrowser({ enabled, query });
  const [rows, setRows] = useState<StudyBrowserListResponse['rows']>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    () => searchParams.get('noteId') ?? ''
  );
  const detailQuery = useStudyBrowserNoteDetail({
    enabled,
    noteId: selectedNoteId || undefined,
  });
  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => searchParams.get('cardId') ?? ''
  );
  const selectedCardIdRef = useRef(selectedCardId);
  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const [editorResetToken, setEditorResetToken] = useState(0);
  const [showSetDueControls, setShowSetDueControls] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [promotedCardId, setPromotedCardId] = useState<string | null>(null);
  const runBackgroundTask = useStudyBackgroundTask();
  const mutationResetRef = useRef({
    updateCard: updateCardMutation.reset,
    regenerateAudio: regenerateAudioMutation.reset,
    regenerateImage: regenerateImageMutation.reset,
    deleteCard: deleteCardMutation.reset,
    promoteNewCard: promoteNewCardMutation.reset,
  });
  mutationResetRef.current = {
    updateCard: updateCardMutation.reset,
    regenerateAudio: regenerateAudioMutation.reset,
    regenerateImage: regenerateImageMutation.reset,
    deleteCard: deleteCardMutation.reset,
    promoteNewCard: promoteNewCardMutation.reset,
  };

  useEffect(() => {
    if (!browserQuery.data) return;

    setRows((current) => {
      if (!query.cursor) return browserQuery.data.rows;

      const seen = new Set(current.map((row) => row.noteId));
      const appended = browserQuery.data.rows.filter((row) => !seen.has(row.noteId));
      return [...current, ...appended];
    });
  }, [browserQuery.data, query.cursor]);

  useEffect(() => {
    selectedCardIdRef.current = selectedCardId;
  }, [selectedCardId]);

  useEffect(() => {
    if (!rows.length) {
      // Preserve a deep-linked selection while the first query result is still
      // being copied into local pagination state. Clear it only for a confirmed
      // empty result set.
      if (!browserQuery.data || browserQuery.data.rows.length) return;
      setSelectedNoteId('');
      return;
    }

    if (selectedNoteId && !rows.some((row) => row.noteId === selectedNoteId)) {
      setSelectedNoteId(rows[0].noteId);
    }
  }, [browserQuery.data, rows, selectedNoteId]);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;

    const nextCardId =
      detail.cards.find((card) => card.id === selectedCardIdRef.current)?.id ??
      detail.selectedCardId ??
      detail.cards[0]?.id ??
      '';
    setSelectedCardId(nextCardId);
  }, [detailQuery.data]);

  useEffect(() => {
    if (!selectedNoteId) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('noteId', selectedNoteId);
    if (selectedCardId) nextParams.set('cardId', selectedCardId);
    else nextParams.delete('cardId');

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedCardId, selectedNoteId, setSearchParams]);

  useEffect(() => {
    setShowSetDueControls(false);
    setIsPreviewOpen(false);
    setPromotedCardId(null);
    mutationResetRef.current.updateCard?.();
    mutationResetRef.current.regenerateAudio?.();
    mutationResetRef.current.regenerateImage?.();
    mutationResetRef.current.deleteCard?.();
    mutationResetRef.current.promoteNewCard?.();
    setEditorResetToken((current) => current + 1);
  }, [selectedCardId]);

  const selectedDetail = detailQuery.data;
  const selectedCard = useMemo(
    () => selectedDetail?.cards.find((card) => card.id === selectedCardId) ?? null,
    [selectedCardId, selectedDetail]
  );
  const selectedCardStats = useMemo(
    () => selectedDetail?.cardStats.find((entry) => entry.cardId === selectedCardId) ?? null,
    [selectedCardId, selectedDetail]
  );

  const actionErrorMessage =
    errorMessage(cardActionMutation.error) ??
    errorMessage(promoteNewCardMutation.error) ??
    errorMessage(updateCardMutation.error) ??
    errorMessage(deleteCardMutation.error);
  const updateCardErrorMessage =
    errorMessage(updateCardMutation.error, 'Card update failed.') ??
    errorMessage(regenerateAudioMutation.error, 'Audio regeneration failed.') ??
    errorMessage(regenerateImageMutation.error, 'Image regeneration failed.');
  const isCardMutationPending =
    updateCardMutation.isPending || deleteCardMutation.isPending || cardActionMutation.isPending;

  const updateQuery = (patch: Partial<StudyBrowserQuery>) => {
    setQuery((current) => ({ ...current, ...patch, cursor: undefined }));
  };

  const showNoteList = () => {
    setSelectedNoteId('');
    setSelectedCardId('');

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('noteId');
    nextParams.delete('cardId');
    setSearchParams(nextParams, { replace: true });
  };

  const handleCardAction = async (
    action: 'suspend' | 'unsuspend' | 'forget' | 'set_due',
    options?: SetDueOptions
  ) => {
    if (!selectedCard) return;

    await cardActionMutation.mutateAsync({
      cardId: selectedCard.id,
      action,
      mode: options?.mode,
      dueAt: options?.dueAt,
      timeZone: options?.mode === 'tomorrow' ? getDeviceStudyTimeZone() : undefined,
    });
    setShowSetDueControls(false);
    setEditorResetToken((current) => current + 1);
    await detailQuery.refetch();
    await browserQuery.refetch();
  };

  const deleteSelectedCard = async () => {
    if (!selectedCard) return;

    const deletedNoteId = selectedCard.noteId;
    const deletedCardId = selectedCard.id;
    const remainingCards = selectedDetail?.cards.filter((card) => card.id !== deletedCardId) ?? [];

    try {
      await deleteCardMutation.mutateAsync(deletedCardId);

      if (remainingCards.length > 0) {
        setSelectedCardId(remainingCards[0]?.id ?? '');
        await detailQuery.refetch();
        await browserQuery.refetch();
        return;
      }

      const nextRows = rows.filter((row) => row.noteId !== deletedNoteId);
      setRows(nextRows);
      setSelectedNoteId(nextRows[0]?.noteId ?? '');
      setSelectedCardId('');
      await browserQuery.refetch();
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };

  const saveSelectedCard = async ({ prompt, answer }: SaveSelectedCardPayload) => {
    if (!selectedCard) return;
    await updateCardMutation.mutateAsync({
      cardId: selectedCard.id,
      expectedRevision: selectedCard.revision ?? 0,
      prompt,
      answer,
    });
    setEditorResetToken((current) => current + 1);
    await detailQuery.refetch();
    await browserQuery.refetch();
  };

  const regenerateSelectedAudio = async (payload: RegenerateSelectedAudioPayload) => {
    if (!selectedCard) return undefined;
    const updatedCard = await regenerateAudioMutation.mutateAsync({
      cardId: selectedCard.id,
      ...payload,
    });
    await detailQuery.refetch();
    await browserQuery.refetch();
    return updatedCard;
  };

  const regenerateSelectedImage = async (payload: StudyCardRegenerateImageRequest) => {
    if (!selectedCard) return undefined;
    const updatedCard = await regenerateImageMutation.mutateAsync({
      cardId: selectedCard.id,
      ...payload,
    });
    await detailQuery.refetch();
    await browserQuery.refetch();
    return updatedCard;
  };

  return {
    query,
    searchInput,
    setSearchInput,
    submitSearch: () => updateQuery({ q: searchInput.trim() || undefined }),
    setNoteType: (noteType: string) => updateQuery({ noteType: noteType || undefined }),
    setCardType: (cardType: StudyBrowserQuery['cardType'] | '') =>
      updateQuery({ cardType: cardType || undefined }),
    setQueueState: (queueState: StudyBrowserQuery['queueState'] | '') =>
      updateQuery({ queueState: queueState || undefined }),
    setSortField: (sortField: NonNullable<StudyBrowserQuery['sortField']>) =>
      updateQuery({ sortField }),
    setSortDirection: (sortDirection: NonNullable<StudyBrowserQuery['sortDirection']>) =>
      updateQuery({ sortDirection }),
    browserData: browserQuery.data,
    isBrowserLoading: browserQuery.isLoading,
    browserError: browserQuery.error,
    rows,
    loadMore: () => {
      if (!browserQuery.data?.nextCursor) return;
      setQuery((current) => ({ ...current, cursor: browserQuery.data.nextCursor ?? undefined }));
    },
    selectedNoteId,
    selectNote: setSelectedNoteId,
    showNoteList,
    selectedCardId,
    selectCard: setSelectedCardId,
    selectedDetail,
    isDetailLoading: detailQuery.isLoading,
    detailError: detailQuery.error,
    selectedCard,
    selectedCardStats,
    editorSectionRef,
    editorResetToken,
    resetEditor: () => setEditorResetToken((current) => current + 1),
    showSetDueControls,
    toggleSetDueControls: () => setShowSetDueControls((current) => !current),
    closeSetDueControls: () => setShowSetDueControls(false),
    isPreviewOpen,
    openPreview: () => setIsPreviewOpen(true),
    closePreview: () => setIsPreviewOpen(false),
    closePreviewAndFocusEditor: () => {
      setIsPreviewOpen(false);
      window.requestAnimationFrame(() => {
        editorSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        editorSectionRef.current?.focus();
      });
    },
    isDeleteConfirmOpen,
    openDeleteConfirm: () => setIsDeleteConfirmOpen(true),
    closeDeleteConfirm: () => setIsDeleteConfirmOpen(false),
    confirmDelete: () => {
      runBackgroundTask(deleteSelectedCard, { label: 'Study browse card delete' });
    },
    suspendOrUnsuspendSelectedCard: () => {
      if (!selectedCard) return;
      runBackgroundTask(
        () =>
          handleCardAction(selectedCard.state.queueState === 'suspended' ? 'unsuspend' : 'suspend'),
        { label: 'Study browse card action' }
      );
    },
    forgetSelectedCard: () => {
      runBackgroundTask(() => handleCardAction('forget'), {
        label: 'Study browse card action',
      });
    },
    setSelectedCardDue: (options: SetDueOptions) => handleCardAction('set_due', options),
    promoteSelectedCard: () => {
      if (!selectedCard) return;
      runBackgroundTask(
        async () => {
          await promoteNewCardMutation.mutateAsync(selectedCard.id);
          setPromotedCardId(selectedCard.id);
        },
        { label: 'Promote study new card' }
      );
    },
    promotedCardId,
    actionErrorMessage,
    updateCardErrorMessage,
    isCardMutationPending,
    isUpdatePending: updateCardMutation.isPending,
    isDeletePending: deleteCardMutation.isPending,
    isCardActionPending: cardActionMutation.isPending,
    isPromotePending: promoteNewCardMutation.isPending,
    isRegeneratingAudio: regenerateAudioMutation.isPending,
    isRegeneratingImage: regenerateImageMutation.isPending,
    saveSelectedCard,
    regenerateSelectedAudio,
    regenerateSelectedImage,
  };
}

export type StudyBrowseController = ReturnType<typeof useStudyBrowseController>;
