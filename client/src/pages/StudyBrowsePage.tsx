import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { STUDY_BROWSER_PAGE_SIZE_DEFAULT } from '@languageflow/shared/src/studyConstants';
import type { StudyBrowserField, StudyBrowserListResponse } from '@languageflow/shared/src/types';

import StudyCardEditor from '../components/study/StudyCardEditor';
import StudyFormField from '../components/study/StudyFormField';
import StudySetDueControls from '../components/study/StudySetDueControls';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  type StudyBrowserQuery,
  useStudyCardAction,
  useStudyBrowser,
  useStudyBrowserNoteDetail,
  useRegenerateStudyAnswerAudio,
  useUpdateStudyCard,
} from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';
import { getAudioMimeType, toAssetUrl } from '../components/study/studyCardUtils';

const FieldValue = ({ field }: { field: StudyBrowserField }) => {
  const { t } = useTranslation('study');
  const imageUrl = toAssetUrl(field.image?.url);
  const audioUrl = toAssetUrl(field.audio?.url);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white/80 p-4">
      {field.textValue ? (
        <p className="whitespace-pre-wrap break-words text-gray-900">{field.textValue}</p>
      ) : null}
      {imageUrl ? (
        <img src={imageUrl} alt={field.name} className="max-h-64 rounded-lg object-contain" />
      ) : null}
      {audioUrl ? (
        <audio controls preload="metadata" className="w-full max-w-xl">
          <source src={audioUrl} type={getAudioMimeType(audioUrl, field.audio?.filename)} />
        </audio>
      ) : null}
      {!field.textValue && !imageUrl && !audioUrl ? (
        <p className="text-sm text-gray-400">{t('browse.noPreview')}</p>
      ) : null}
    </div>
  );
};

const StudyBrowsePage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const updateCardMutation = useUpdateStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const cardActionMutation = useStudyCardAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<StudyBrowserQuery>({
    limit: STUDY_BROWSER_PAGE_SIZE_DEFAULT,
  });
  const browserQuery = useStudyBrowser(enabled, query);
  const [rows, setRows] = useState<StudyBrowserListResponse['rows']>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    () => searchParams.get('noteId') ?? ''
  );
  const detailQuery = useStudyBrowserNoteDetail(enabled, selectedNoteId || undefined);
  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => searchParams.get('cardId') ?? ''
  );
  const selectedCardIdRef = useRef(selectedCardId);
  // In the always-editor browse flow, Cancel means discard local edits by remounting the editor.
  const [editorResetToken, setEditorResetToken] = useState(0);
  const [showSetDueControls, setShowSetDueControls] = useState(false);
  const runBackgroundTask = useStudyBackgroundTask();

  useEffect(() => {
    if (!browserQuery.data) return;

    setRows((current) => {
      if (!query.cursor) {
        return browserQuery.data.rows;
      }

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
      setSelectedNoteId('');
      return;
    }

    if (!selectedNoteId || !rows.some((row) => row.noteId === selectedNoteId)) {
      setSelectedNoteId(rows[0].noteId);
    }
  }, [rows, selectedNoteId]);

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
    if (selectedCardId) {
      nextParams.set('cardId', selectedCardId);
    } else {
      nextParams.delete('cardId');
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedCardId, selectedNoteId, setSearchParams]);

  useEffect(() => {
    setShowSetDueControls(false);
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
  let actionErrorMessage: string | null = null;
  if (cardActionMutation.error instanceof Error) {
    actionErrorMessage = cardActionMutation.error.message;
  } else if (updateCardMutation.error instanceof Error) {
    actionErrorMessage = updateCardMutation.error.message;
  }

  const handleCardAction = async (
    action: 'suspend' | 'unsuspend' | 'forget' | 'set_due',
    options?: { mode?: 'now' | 'tomorrow' | 'custom_date'; dueAt?: string }
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

  let updateCardErrorMessage: string | null = null;
  if (updateCardMutation.error instanceof Error) {
    updateCardErrorMessage = updateCardMutation.error.message;
  } else if (regenerateAudioMutation.error instanceof Error) {
    updateCardErrorMessage = regenerateAudioMutation.error.message;
  } else if (updateCardMutation.error) {
    updateCardErrorMessage = 'Card update failed.';
  } else if (regenerateAudioMutation.error) {
    updateCardErrorMessage = 'Audio regeneration failed.';
  }

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">{t('browse.title')}</h1>
            <p className="text-gray-600">{t('browse.description')}</p>
          </div>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('browse.back')}
          </Link>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((current) => ({
              ...current,
              q: searchInput.trim() || undefined,
              cursor: undefined,
            }));
          }}
        >
          <StudyFormField
            htmlFor="study-browser-search"
            label={t('browse.searchLabel')}
            className="min-w-[18rem] flex-1"
          >
            <input
              id="study-browser-search"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('browse.searchPlaceholder')}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-note-type"
            label={t('browse.noteType')}
            className="min-w-[12rem]"
          >
            <select
              id="study-browser-note-type"
              value={query.noteType ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  noteType: event.target.value || undefined,
                  cursor: undefined,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">{t('browse.allNoteTypes')}</option>
              {(browserQuery.data?.filterOptions.noteTypes ?? []).map((noteType) => (
                <option key={noteType} value={noteType}>
                  {noteType}
                </option>
              ))}
            </select>
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-card-type"
            label={t('browse.cardType')}
            className="min-w-[10rem]"
          >
            <select
              id="study-browser-card-type"
              value={query.cardType ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  cardType: (event.target.value || undefined) as StudyBrowserQuery['cardType'],
                  cursor: undefined,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">{t('browse.allCardTypes')}</option>
              {(browserQuery.data?.filterOptions.cardTypes ?? []).map((cardType) => (
                <option key={cardType} value={cardType}>
                  {cardType}
                </option>
              ))}
            </select>
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-queue"
            label={t('browse.queueState')}
            className="min-w-[10rem]"
          >
            <select
              id="study-browser-queue"
              value={query.queueState ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  queueState: (event.target.value || undefined) as StudyBrowserQuery['queueState'],
                  cursor: undefined,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">{t('browse.allQueueStates')}</option>
              {(browserQuery.data?.filterOptions.queueStates ?? []).map((queueState) => (
                <option key={queueState} value={queueState}>
                  {queueState}
                </option>
              ))}
            </select>
          </StudyFormField>

          <button
            type="submit"
            className="w-full rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
          >
            {t('browse.search')}
          </button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(26rem,38rem)_minmax(0,1fr)]">
        <div
          data-testid="study-browser-note-list"
          className="card retro-paper-panel min-w-0 overflow-hidden"
        >
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              {query.q
                ? t('browse.notesMatching', {
                    count: browserQuery.data?.total ?? 0,
                    query: query.q,
                  })
                : t('browse.notesCount', { count: browserQuery.data?.total ?? 0 })}
            </p>
          </div>

          {browserQuery.isLoading ? (
            <p className="p-6 text-gray-500">{t('browse.loadingNotes')}</p>
          ) : null}
          {browserQuery.error ? (
            <p className="p-6 text-red-600">
              {browserQuery.error instanceof Error
                ? browserQuery.error.message
                : t('browse.failedNotes')}
            </p>
          ) : null}

          {!browserQuery.isLoading && !rows.length ? (
            <div className="p-6 text-center text-gray-600">{t('browse.noMatches')}</div>
          ) : null}

          {rows.length ? (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {rows.map((row) => (
                  <button
                    key={row.noteId}
                    type="button"
                    data-testid="study-browser-note-item"
                    className={`block w-full rounded-2xl border px-4 py-4 text-left ${
                      row.noteId === selectedNoteId
                        ? 'border-navy bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-cream/50'
                    }`}
                    onClick={() => setSelectedNoteId(row.noteId)}
                  >
                    <p className="break-words text-base font-semibold text-gray-900">
                      {row.displayText}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {row.noteTypeName ?? t('browse.unknown')} ·{' '}
                      {t('browse.cardsLabel', { count: row.cardCount })} ·{' '}
                      {t('browse.reviewsLabel', { count: row.reviewCount })}
                    </p>
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-cream/60 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('browse.sortField')}</th>
                      <th className="px-4 py-3 font-medium">{t('browse.noteType')}</th>
                      <th className="px-4 py-3 font-medium">{t('browse.cardsHeader')}</th>
                      <th className="px-4 py-3 font-medium">{t('browse.reviewsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.noteId}
                        className={`cursor-pointer border-t border-gray-200 ${
                          row.noteId === selectedNoteId ? 'bg-blue-100/70' : 'hover:bg-cream/50'
                        }`}
                        onClick={() => setSelectedNoteId(row.noteId)}
                      >
                        <td className="max-w-[16rem] px-4 py-3 align-top">
                          <p className="line-clamp-2 break-words text-gray-900">
                            {row.displayText}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-700">
                          {row.noteTypeName ?? t('browse.unknown')}
                        </td>
                        <td className="px-4 py-3 align-top text-gray-700">{row.cardCount}</td>
                        <td className="px-4 py-3 align-top text-gray-700">{row.reviewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {t('browse.showing', {
                shown: rows.length,
                total: browserQuery.data?.total ?? 0,
              })}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <button
                type="button"
                disabled={!browserQuery.data?.nextCursor || browserQuery.isLoading}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    cursor: browserQuery.data?.nextCursor ?? undefined,
                  }))
                }
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                {browserQuery.isLoading && query.cursor
                  ? t('browse.loadingMore')
                  : t('browse.loadMore')}
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <section data-testid="study-browser-detail" className="card retro-paper-panel min-w-0">
            {detailQuery.isLoading ? (
              <p className="text-gray-500">{t('browse.loadingDetail')}</p>
            ) : null}
            {detailQuery.error ? (
              <p className="text-red-600">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : t('browse.failedDetail')}
              </p>
            ) : null}

            {selectedDetail ? (
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-semibold text-navy">
                      {selectedDetail.displayText}
                    </h2>
                    <p className="break-words text-sm text-gray-500">
                      {selectedDetail.noteTypeName ?? t('browse.unknownNoteType')} ·{' '}
                      {t('browse.updated', {
                        value: new Date(selectedDetail.updatedAt).toLocaleString(),
                      })}
                    </p>
                  </div>
                </div>

                {selectedDetail.cards.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedDetail.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setSelectedCardId(card.id);
                        }}
                        className={`rounded-full border px-3 py-2 text-sm font-medium ${
                          selectedCardId === card.id
                            ? 'border-navy bg-navy text-white'
                            : 'border-gray-300 bg-white text-navy'
                        }`}
                      >
                        {card.state.source.templateName ?? card.cardType}
                      </button>
                    ))}
                  </div>
                ) : null}

                {selectedCard ? (
                  <div
                    data-testid="study-browser-preview"
                    className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-[2rem] bg-white px-4 py-6 shadow-sm ring-1 ring-gray-200 sm:px-6 sm:py-10 md:px-12"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="break-words text-sm text-gray-500">
                        {t('browse.queue')}:{' '}
                        <span className="font-medium text-gray-700">
                          {selectedCard.state.queueState}
                        </span>
                        {selectedCard.state.dueAt
                          ? ` · ${t('browse.due', {
                              value: new Date(selectedCard.state.dueAt).toLocaleString(),
                            })}`
                          : ''}
                      </p>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            runBackgroundTask(
                              () =>
                                handleCardAction(
                                  selectedCard.state.queueState === 'suspended'
                                    ? 'unsuspend'
                                    : 'suspend'
                                ),
                              {
                                label: 'Study browse card action',
                              }
                            );
                          }}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {selectedCard.state.queueState === 'suspended'
                            ? t('reviewActions.unsuspend')
                            : t('reviewActions.suspend')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            runBackgroundTask(() => handleCardAction('forget'), {
                              label: 'Study browse card action',
                            });
                          }}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('browse.forget')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSetDueControls((current) => !current)}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('browse.setDue')}
                        </button>
                      </div>
                    </div>

                    {showSetDueControls ? (
                      <StudySetDueControls
                        disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                        isSubmitting={cardActionMutation.isPending}
                        onCancel={() => setShowSetDueControls(false)}
                        onSubmit={async ({ mode, dueAt }) => {
                          await handleCardAction('set_due', { mode, dueAt });
                        }}
                      />
                    ) : null}

                    {actionErrorMessage ? (
                      <p className="text-sm text-red-600">{actionErrorMessage}</p>
                    ) : null}

                    <StudyCardEditor
                      key={`${selectedCard.id}:${editorResetToken}`}
                      card={selectedCard}
                      isSaving={updateCardMutation.isPending}
                      isRegeneratingAudio={regenerateAudioMutation.isPending}
                      error={updateCardErrorMessage}
                      onCancel={() => setEditorResetToken((current) => current + 1)}
                      onSave={async ({ prompt, answer }) => {
                        await updateCardMutation.mutateAsync({
                          cardId: selectedCard.id,
                          prompt,
                          answer,
                        });
                        setEditorResetToken((current) => current + 1);
                        await detailQuery.refetch();
                        await browserQuery.refetch();
                      }}
                      onRegenerateAudio={async ({
                        answerAudioVoiceId,
                        answerAudioTextOverride,
                      }) => {
                        const updatedCard = await regenerateAudioMutation.mutateAsync({
                          cardId: selectedCard.id,
                          answerAudioVoiceId,
                          answerAudioTextOverride,
                        });
                        await detailQuery.refetch();
                        await browserQuery.refetch();
                        return updatedCard;
                      }}
                    />
                  </div>
                ) : null}

                {selectedCardStats ? (
                  <p className="text-sm text-gray-500">
                    {selectedCardStats.reviewCount} reviews
                    {selectedCardStats.lastReviewedAt
                      ? ` · Last reviewed ${new Date(selectedCardStats.lastReviewedAt).toLocaleString()}`
                      : ''}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-gray-500">{t('browse.selectNote')}</p>
            )}
          </section>

          {selectedDetail ? (
            <>
              <section className="card retro-paper-panel">
                <details open>
                  <summary className="cursor-pointer text-lg font-semibold text-navy">
                    {t('browse.importedFields')}
                  </summary>
                  <div className="mt-4 space-y-4">
                    {selectedDetail.rawFields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">{field.name}</p>
                        <FieldValue field={field} />
                      </div>
                    ))}
                  </div>
                </details>
              </section>

              {selectedDetail.canonicalFields.length ? (
                <section className="card retro-paper-panel">
                  <details>
                    <summary className="cursor-pointer text-lg font-semibold text-navy">
                      {t('browse.canonicalFields')}
                    </summary>
                    <div className="mt-4 space-y-4">
                      {selectedDetail.canonicalFields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">{field.name}</p>
                          <FieldValue field={field} />
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default StudyBrowsePage;
