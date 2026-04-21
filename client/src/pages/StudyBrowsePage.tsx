import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { StudyBrowserField } from '@shared/types';

import StudyCardEditor from '../components/study/StudyCardEditor';
import StudyFormField from '../components/study/StudyFormField';
import StudySetDueControls from '../components/study/StudySetDueControls';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  type StudyBrowserQuery,
  useStudyCardAction,
  useStudyBrowser,
  useStudyBrowserNoteDetail,
  useUpdateStudyCard,
} from '../hooks/useStudy';
import { StudyCardFace } from '../components/study/StudyCardPreview';
import { toAssetUrl } from '../components/study/studyCardUtils';

const PAGE_SIZE = 100;

const FieldValue = ({ field }: { field: StudyBrowserField }) => {
  const imageUrl = toAssetUrl(field.image?.url);
  const audioUrl = toAssetUrl(field.audio?.url);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white/80 p-4">
      {field.textValue ? (
        <p className="whitespace-pre-wrap text-gray-900">{field.textValue}</p>
      ) : null}
      {imageUrl ? (
        <img src={imageUrl} alt={field.name} className="max-h-64 rounded-lg object-contain" />
      ) : null}
      {audioUrl ? (
        <audio controls preload="metadata" className="w-full max-w-xl">
          <source src={audioUrl} type="audio/mpeg" />
        </audio>
      ) : null}
      {!field.textValue && !imageUrl && !audioUrl ? (
        <p className="text-sm text-gray-400">No previewable value</p>
      ) : null}
    </div>
  );
};

const StudyBrowsePage = () => {
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const updateCardMutation = useUpdateStudyCard();
  const cardActionMutation = useStudyCardAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<StudyBrowserQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const browserQuery = useStudyBrowser(enabled, query);
  const rows = useMemo(() => browserQuery.data?.rows ?? [], [browserQuery.data?.rows]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    () => searchParams.get('noteId') ?? ''
  );
  const detailQuery = useStudyBrowserNoteDetail(enabled, selectedNoteId || undefined);
  const [selectedCardId, setSelectedCardId] = useState<string>(
    () => searchParams.get('cardId') ?? ''
  );
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [editing, setEditing] = useState(false);
  const [showSetDueControls, setShowSetDueControls] = useState(false);

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
      detail.cards.find((card) => card.id === selectedCardId)?.id ??
      detail.selectedCardId ??
      detail.cards[0]?.id ??
      '';
    setSelectedCardId(nextCardId);
    setPreviewSide('front');
  }, [detailQuery.data, selectedCardId]);

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
    setEditing(false);
    setShowSetDueControls(false);
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
  const ignorePromise = (task?: Promise<unknown>) => {
    task?.catch(() => {});
  };
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
    });
    setPreviewSide('front');
    setEditing(false);
    setShowSetDueControls(false);
    await detailQuery.refetch();
    await browserQuery.refetch();
  };

  const totalPages = Math.max(
    1,
    Math.ceil((browserQuery.data?.total ?? 0) / (query.pageSize ?? PAGE_SIZE))
  );
  let updateCardErrorMessage: string | null = null;
  if (updateCardMutation.error instanceof Error) {
    updateCardErrorMessage = updateCardMutation.error.message;
  } else if (updateCardMutation.error) {
    updateCardErrorMessage = 'Card update failed.';
  }

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">Browse cards</h1>
            <p className="text-gray-600">
              Search notes, inspect imported fields, and preview cards without changing scheduling.
            </p>
          </div>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            Back to study
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
              page: 1,
            }));
          }}
        >
          <StudyFormField
            htmlFor="study-browser-search"
            label="Search cards/notes"
            className="min-w-[18rem] flex-1"
          >
            <input
              id="study-browser-search"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Type text, then press Enter"
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-note-type"
            label="Note type"
            className="min-w-[12rem]"
          >
            <select
              id="study-browser-note-type"
              value={query.noteType ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  noteType: event.target.value || undefined,
                  page: 1,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">All note types</option>
              {(browserQuery.data?.filterOptions.noteTypes ?? []).map((noteType) => (
                <option key={noteType} value={noteType}>
                  {noteType}
                </option>
              ))}
            </select>
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-card-type"
            label="Card type"
            className="min-w-[10rem]"
          >
            <select
              id="study-browser-card-type"
              value={query.cardType ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  cardType: (event.target.value || undefined) as StudyBrowserQuery['cardType'],
                  page: 1,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">All card types</option>
              {(browserQuery.data?.filterOptions.cardTypes ?? []).map((cardType) => (
                <option key={cardType} value={cardType}>
                  {cardType}
                </option>
              ))}
            </select>
          </StudyFormField>

          <StudyFormField
            htmlFor="study-browser-queue"
            label="Queue state"
            className="min-w-[10rem]"
          >
            <select
              id="study-browser-queue"
              value={query.queueState ?? ''}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  queueState: (event.target.value || undefined) as StudyBrowserQuery['queueState'],
                  page: 1,
                }))
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">All queue states</option>
              {(browserQuery.data?.filterOptions.queueStates ?? []).map((queueState) => (
                <option key={queueState} value={queueState}>
                  {queueState}
                </option>
              ))}
            </select>
          </StudyFormField>

          <button
            type="submit"
            className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Search
          </button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(26rem,38rem)_minmax(0,1fr)]">
        <div className="card retro-paper-panel overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-600">
              {browserQuery.data?.total ?? 0} notes
              {query.q ? ` matching “${query.q}”` : ''}
            </p>
          </div>

          {browserQuery.isLoading ? <p className="p-6 text-gray-500">Loading notes…</p> : null}
          {browserQuery.error ? (
            <p className="p-6 text-red-600">
              {browserQuery.error instanceof Error
                ? browserQuery.error.message
                : 'Failed to load notes.'}
            </p>
          ) : null}

          {!browserQuery.isLoading && !rows.length ? (
            <div className="p-6 text-center text-gray-600">No notes match the current filters.</div>
          ) : null}

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-cream/60 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sort field</th>
                    <th className="px-4 py-3 font-medium">Note type</th>
                    <th className="px-4 py-3 font-medium">Cards</th>
                    <th className="px-4 py-3 font-medium">Reviews</th>
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
                        <p className="line-clamp-2 text-gray-900">{row.displayText}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {row.noteTypeName ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">{row.cardCount}</td>
                      <td className="px-4 py-3 align-top text-gray-700">{row.reviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {query.page ?? 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(query.page ?? 1) <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.max(1, (current.page ?? 1) - 1),
                  }))
                }
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={(query.page ?? 1) >= totalPages}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.min(totalPages, (current.page ?? 1) + 1),
                  }))
                }
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card retro-paper-panel">
            {detailQuery.isLoading ? <p className="text-gray-500">Loading note preview…</p> : null}
            {detailQuery.error ? (
              <p className="text-red-600">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : 'Failed to load note detail.'}
              </p>
            ) : null}

            {selectedDetail ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-navy">
                      {selectedDetail.displayText}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedDetail.noteTypeName ?? 'Unknown note type'} · Updated{' '}
                      {new Date(selectedDetail.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-gray-300 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewSide('front')}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        previewSide === 'front' ? 'bg-navy text-white' : 'text-navy'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSide('back')}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        previewSide === 'back' ? 'bg-navy text-white' : 'text-navy'
                      }`}
                    >
                      Back
                    </button>
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
                          setPreviewSide('front');
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
                  <div className="space-y-4 rounded-[2rem] bg-white px-6 py-10 shadow-sm ring-1 ring-gray-200 md:px-12">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-gray-500">
                        Queue:{' '}
                        <span className="font-medium text-gray-700">
                          {selectedCard.state.queueState}
                        </span>
                        {selectedCard.state.dueAt
                          ? ` · Due ${new Date(selectedCard.state.dueAt).toLocaleString()}`
                          : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            ignorePromise(
                              handleCardAction(
                                selectedCard.state.queueState === 'suspended'
                                  ? 'unsuspend'
                                  : 'suspend'
                              )
                            );
                          }}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {selectedCard.state.queueState === 'suspended' ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            ignorePromise(handleCardAction('forget'));
                          }}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Forget
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSetDueControls((current) => !current)}
                          disabled={updateCardMutation.isPending || cardActionMutation.isPending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Set due
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

                    {editing ? (
                      <StudyCardEditor
                        card={selectedCard}
                        isSaving={updateCardMutation.isPending}
                        error={updateCardErrorMessage}
                        onCancel={() => setEditing(false)}
                        onSave={async ({ prompt, answer }) => {
                          await updateCardMutation.mutateAsync({
                            cardId: selectedCard.id,
                            prompt,
                            answer,
                          });
                          setEditing(false);
                          setPreviewSide('front');
                          await detailQuery.refetch();
                          await browserQuery.refetch();
                        }}
                      />
                    ) : (
                      <StudyCardFace card={selectedCard} side={previewSide} />
                    )}
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
              <p className="text-gray-500">Select a note to preview it.</p>
            )}
          </section>

          {selectedDetail ? (
            <>
              <section className="card retro-paper-panel">
                <details open>
                  <summary className="cursor-pointer text-lg font-semibold text-navy">
                    Imported fields
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
                      Canonical fields
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
