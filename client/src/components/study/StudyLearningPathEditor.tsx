import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  getStudyCards,
  useLinkStudyLearningPathSuccessor,
  useStudyLearningPath,
} from '../../hooks/useStudy';
import type { StudyLearningPathUnlockRequirement } from '../../hooks/useStudy';

interface StudyLearningPathEditorProps {
  card: StudyCardSummary;
}

const cardDisplayText = (card: StudyCardSummary) =>
  card.prompt.clozeDisplayText ??
  card.prompt.cueText ??
  card.answer.expressionReading ??
  card.answer.expression ??
  card.prompt.clozeText ??
  card.id;

const cardMeaning = (card: StudyCardSummary) =>
  card.answer.meaning ?? card.prompt.cueMeaning ?? card.answer.sentenceEn ?? '';

const canonicalCardId = (card: StudyCardSummary) => card.syncId ?? card.id;

const defaultUnlockRequirement = (card: StudyCardSummary): StudyLearningPathUnlockRequirement =>
  card.cardType === 'cloze' || card.cardType === 'production' ? 'master' : 'guru';

const browserHref = (cardId: string, noteId: string | null) => {
  const params = new URLSearchParams({ cardId, noteId: noteId ?? cardId });
  return `/app/study/browse?${params.toString()}`;
};

const StudyLearningPathEditor = ({ card }: StudyLearningPathEditorProps) => {
  const { t } = useTranslation('study');
  const currentCardId = canonicalCardId(card);
  const pathQuery = useStudyLearningPath(currentCardId);
  const linkMutation = useLinkStudyLearningPathSuccessor();
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<StudyCardSummary[]>([]);
  const [selectedSuccessor, setSelectedSuccessor] = useState<StudyCardSummary | null>(null);
  const [unlockRequirement, setUnlockRequirement] =
    useState<StudyLearningPathUnlockRequirement>('guru');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const searchRequestId = useRef(0);

  useEffect(() => {
    setSearchInput('');
    setSearchResults([]);
    setSelectedSuccessor(null);
    setUnlockRequirement('guru');
    setSearchError(null);
    setHasSearched(false);
    setHasMoreResults(false);
    setLinkedSuccess(false);
    searchRequestId.current += 1;
  }, [currentCardId]);

  const pathCardIds = useMemo(
    () => new Set(pathQuery.data?.stages.flatMap((stage) => stage.cards.map((item) => item.id))),
    [pathQuery.data]
  );
  const tailStage = pathQuery.data?.stages.at(-1) ?? null;
  const isTail =
    !pathQuery.data ||
    pathQuery.data.stages.length === 0 ||
    Boolean(tailStage?.cards.some((item) => item.id === currentCardId));
  const tailCard = tailStage?.cards.at(-1) ?? null;

  const runSearch = async () => {
    const query = searchInput.trim();
    if (!query) return;

    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    setIsSearching(true);
    setSearchError(null);
    setLinkedSuccess(false);
    try {
      const response = await getStudyCards({ q: query, limit: 20 });
      if (searchRequestId.current !== requestId) return;
      setSearchResults(
        response.items.filter(
          (item) =>
            canonicalCardId(item) !== currentCardId && !pathCardIds.has(canonicalCardId(item))
        )
      );
      setHasSearched(true);
      setHasMoreResults(Boolean(response.nextCursor));
    } catch (error) {
      if (searchRequestId.current !== requestId) return;
      setSearchError(error instanceof Error ? error.message : t('learningPath.searchFailed'));
      setSearchResults([]);
      setHasSearched(false);
      setHasMoreResults(false);
    } finally {
      if (searchRequestId.current === requestId) setIsSearching(false);
    }
  };

  return (
    <section
      aria-labelledby={`learning-path-title-${card.id}`}
      className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4"
    >
      <div>
        <h3 id={`learning-path-title-${card.id}`} className="text-base font-semibold text-navy">
          {t('learningPath.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{t('learningPath.description')}</p>
      </div>

      {pathQuery.isPending ? (
        <p className="text-sm text-gray-500">{t('learningPath.loading')}</p>
      ) : null}
      {pathQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">
            {pathQuery.error instanceof Error
              ? pathQuery.error.message
              : t('learningPath.loadFailed')}
          </p>
          <button
            type="button"
            onClick={() => pathQuery.refetch()}
            className="text-sm font-semibold text-navy underline"
          >
            {t('learningPath.retry')}
          </button>
        </div>
      ) : null}

      {pathQuery.data ? (
        <>
          {pathQuery.data.stages.length > 0 ? (
            <ol className="space-y-2" aria-label={t('learningPath.stagesLabel')}>
              {pathQuery.data.stages.map((stage, index) => (
                <li
                  key={`${stage.number ?? 'unknown'}-${stage.cards.map((item) => item.id).join('-')}`}
                  className="rounded-xl border border-sky-100 bg-white px-3 py-3"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    {t('learningPath.stage', { number: stage.number ?? index + 1 })}
                  </p>
                  <div className="space-y-2">
                    {stage.cards.map((pathCard) => (
                      <div
                        key={pathCard.id}
                        className="flex min-w-0 items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-navy">
                            {pathCard.displayText}
                          </p>
                          {pathCard.meaning ? (
                            <p className="break-words text-xs text-gray-600">{pathCard.meaning}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {pathCard.id === currentCardId ? (
                            <span className="rounded-full bg-navy px-2 py-1 text-[0.65rem] font-semibold text-white">
                              {t('learningPath.current')}
                            </span>
                          ) : null}
                          {pathCard.variantStatus ? (
                            <span className="rounded-full bg-cream px-2 py-1 text-[0.65rem] font-semibold capitalize text-gray-600">
                              {t(`learningPath.status.${pathCard.variantStatus}`)}
                            </span>
                          ) : null}
                          {pathCard.unlockRequirement ? (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-[0.65rem] font-semibold text-navy">
                              {t(`learningPath.requirementBadge.${pathCard.unlockRequirement}`)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-600">{t('learningPath.startsHere')}</p>
          )}

          {linkedSuccess ? (
            <p
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-medium text-green-700"
            >
              {t('learningPath.linked')}
            </p>
          ) : null}

          {!isTail && tailCard ? (
            <p className="rounded-xl bg-white px-3 py-3 text-sm text-gray-600">
              {t('learningPath.tailOnly')}{' '}
              <Link
                to={browserHref(tailCard.id, tailCard.noteId)}
                className="font-semibold text-navy underline"
              >
                {t('learningPath.editTail', { card: tailCard.displayText })}
              </Link>
            </p>
          ) : null}

          {isTail ? (
            <div className="space-y-3 rounded-xl bg-white p-3">
              <div>
                <p className="text-sm font-semibold text-navy">{t('learningPath.chooseNext')}</p>
                <p className="text-xs text-gray-500">{t('learningPath.chooseNextHelp')}</p>
              </div>
              <div className="flex gap-2">
                <label htmlFor={`learning-path-search-${card.id}`} className="min-w-0 flex-1">
                  <span className="sr-only">{t('learningPath.searchLabel')}</span>
                  <input
                    id={`learning-path-search-${card.id}`}
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        runSearch().catch(() => {});
                      }
                    }}
                    placeholder={t('learningPath.searchPlaceholder')}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => runSearch().catch(() => {})}
                  disabled={!searchInput.trim() || isSearching}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {isSearching ? t('learningPath.searching') : t('learningPath.findCard')}
                </button>
              </div>

              {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}
              {!isSearching && searchResults.length > 0 ? (
                <ul className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSuccessor(result);
                          setUnlockRequirement(defaultUnlockRequirement(result));
                          setLinkedSuccess(false);
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-left ${
                          selectedSuccessor?.id === result.id
                            ? 'border-navy bg-sky-50'
                            : 'border-gray-200 hover:border-navy/40'
                        }`}
                      >
                        <span className="block break-words text-sm font-semibold text-navy">
                          {cardDisplayText(result)}
                        </span>
                        {cardMeaning(result) ? (
                          <span className="block break-words text-xs text-gray-600">
                            {cardMeaning(result)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!isSearching && hasSearched && searchResults.length === 0 ? (
                <p className="text-sm text-gray-600">{t('learningPath.noMatches')}</p>
              ) : null}
              {!isSearching && hasMoreResults ? (
                <p className="text-xs text-gray-500">{t('learningPath.moreMatches')}</p>
              ) : null}

              {selectedSuccessor ? (
                <div className="space-y-2 rounded-xl border border-navy/20 bg-cream/50 p-3">
                  <p className="text-sm text-gray-700">
                    {t('learningPath.confirm', {
                      current: cardDisplayText(card),
                      next: cardDisplayText(selectedSuccessor),
                      requirement: t(`learningPath.requirement.${unlockRequirement}`),
                    })}
                  </p>
                  <label
                    htmlFor={`learning-path-requirement-${card.id}`}
                    className="block text-sm font-medium text-navy"
                  >
                    {t('learningPath.requirementLabel')}
                    <select
                      id={`learning-path-requirement-${card.id}`}
                      aria-label={t('learningPath.requirementLabel')}
                      value={unlockRequirement}
                      onChange={(event) =>
                        setUnlockRequirement(
                          event.target.value as StudyLearningPathUnlockRequirement
                        )
                      }
                      className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                    >
                      <option value="successful_retrieval">
                        {t('learningPath.requirement.successful_retrieval')}
                      </option>
                      <option value="guru">{t('learningPath.requirement.guru')}</option>
                      <option value="master">{t('learningPath.requirement.master')}</option>
                    </select>
                    <span className="mt-1 block text-xs font-normal text-gray-500">
                      {t(`learningPath.requirementHelp.${unlockRequirement}`)}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setLinkedSuccess(false);
                      try {
                        await linkMutation.mutateAsync({
                          cardId: currentCardId,
                          successorCardId: canonicalCardId(selectedSuccessor),
                          unlockRequirement,
                        });
                        setSearchInput('');
                        setSearchResults([]);
                        setHasSearched(false);
                        setHasMoreResults(false);
                        setSelectedSuccessor(null);
                        setLinkedSuccess(true);
                      } catch {
                        // The mutation error is rendered below.
                      }
                    }}
                    disabled={linkMutation.isPending}
                    className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {linkMutation.isPending
                      ? t('learningPath.linking')
                      : t('learningPath.linkNext')}
                  </button>
                </div>
              ) : null}

              {linkMutation.isError ? (
                <p className="text-sm text-red-600">
                  {linkMutation.error instanceof Error
                    ? linkMutation.error.message
                    : t('learningPath.linkFailed')}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

export default StudyLearningPathEditor;
