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

type LearningPathQuery = ReturnType<typeof useStudyLearningPath>;
type LearningPathData = NonNullable<LearningPathQuery['data']>;
type LearningPathStage = LearningPathData['stages'][number];

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

const PathCard = ({
  card,
  currentCardId,
}: {
  card: LearningPathStage['cards'][number];
  currentCardId: string;
}) => {
  const { t } = useTranslation('study');
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-navy">{card.displayText}</p>
        {card.meaning ? <p className="break-words text-xs text-gray-600">{card.meaning}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1">
        {card.id === currentCardId ? (
          <span className="rounded-full bg-navy px-2 py-1 text-[0.65rem] font-semibold text-white">
            {t('learningPath.current')}
          </span>
        ) : null}
        {card.variantStatus ? (
          <span className="rounded-full bg-cream px-2 py-1 text-[0.65rem] font-semibold capitalize text-gray-600">
            {t(`learningPath.status.${card.variantStatus}`)}
          </span>
        ) : null}
        {card.unlockRequirement ? (
          <span className="rounded-full bg-sky-100 px-2 py-1 text-[0.65rem] font-semibold text-navy">
            {t(`learningPath.requirementBadge.${card.unlockRequirement}`)}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const PathStages = ({
  stages,
  currentCardId,
}: {
  stages: LearningPathStage[];
  currentCardId: string;
}) => {
  const { t } = useTranslation('study');
  if (stages.length === 0) {
    return <p className="text-sm text-gray-600">{t('learningPath.startsHere')}</p>;
  }

  return (
    <ol className="space-y-2" aria-label={t('learningPath.stagesLabel')}>
      {stages.map((stage, index) => (
        <li
          key={`${stage.number ?? 'unknown'}-${stage.cards.map((item) => item.id).join('-')}`}
          className="rounded-xl border border-sky-100 bg-white px-3 py-3"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            {t('learningPath.stage', { number: stage.number ?? index + 1 })}
          </p>
          <div className="space-y-2">
            {stage.cards.map((pathCard) => (
              <PathCard key={pathCard.id} card={pathCard} currentCardId={currentCardId} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
};

const PathQueryStatus = ({ pathQuery }: { pathQuery: LearningPathQuery }) => {
  const { t } = useTranslation('study');
  if (pathQuery.isPending) {
    return <p className="text-sm text-gray-500">{t('learningPath.loading')}</p>;
  }
  if (!pathQuery.isError) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-red-600">
        {pathQuery.error instanceof Error ? pathQuery.error.message : t('learningPath.loadFailed')}
      </p>
      <button
        type="button"
        onClick={() => pathQuery.refetch()}
        className="text-sm font-semibold text-navy underline"
      >
        {t('learningPath.retry')}
      </button>
    </div>
  );
};

const TailOnlyNotice = ({ tailCard }: { tailCard: LearningPathStage['cards'][number] }) => {
  const { t } = useTranslation('study');
  return (
    <p className="rounded-xl bg-white px-3 py-3 text-sm text-gray-600">
      {t('learningPath.tailOnly')}{' '}
      <Link
        to={browserHref(tailCard.id, tailCard.noteId)}
        className="font-semibold text-navy underline"
      >
        {t('learningPath.editTail', { card: tailCard.displayText })}
      </Link>
    </p>
  );
};

interface SearchState {
  input: string;
  setInput: (value: string) => void;
  results: StudyCardSummary[];
  selected: StudyCardSummary | null;
  setSelected: (card: StudyCardSummary | null) => void;
  requirement: StudyLearningPathUnlockRequirement;
  setRequirement: (value: StudyLearningPathUnlockRequirement) => void;
  isSearching: boolean;
  hasSearched: boolean;
  hasMoreResults: boolean;
  error: string | null;
  linkedSuccess: boolean;
  setLinkedSuccess: (value: boolean) => void;
  run: () => Promise<void>;
  clearAfterLink: () => void;
}

const useSuccessorSearch = (currentCardId: string, pathCardIds: Set<string>): SearchState => {
  const { t } = useTranslation('study');
  const [input, setInput] = useState('');
  const [results, setResults] = useState<StudyCardSummary[]>([]);
  const [selected, setSelected] = useState<StudyCardSummary | null>(null);
  const [requirement, setRequirement] = useState<StudyLearningPathUnlockRequirement>('guru');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const requestIdRef = useRef(0);

  const clearAfterLink = () => {
    setInput('');
    setResults([]);
    setHasSearched(false);
    setHasMoreResults(false);
    setSelected(null);
    setLinkedSuccess(true);
  };

  useEffect(() => {
    setInput('');
    setResults([]);
    setSelected(null);
    setRequirement('guru');
    setError(null);
    setHasSearched(false);
    setHasMoreResults(false);
    setLinkedSuccess(false);
    requestIdRef.current += 1;
  }, [currentCardId]);

  const run = async () => {
    const query = input.trim();
    if (!query) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSearching(true);
    setError(null);
    setLinkedSuccess(false);
    try {
      const response = await getStudyCards({ q: query, limit: 20 });
      if (requestIdRef.current !== requestId) return;
      setResults(
        response.items.filter(
          (item) =>
            canonicalCardId(item) !== currentCardId && !pathCardIds.has(canonicalCardId(item))
        )
      );
      setHasSearched(true);
      setHasMoreResults(Boolean(response.nextCursor));
    } catch (searchError) {
      if (requestIdRef.current !== requestId) return;
      setError(searchError instanceof Error ? searchError.message : t('learningPath.searchFailed'));
      setResults([]);
      setHasSearched(false);
      setHasMoreResults(false);
    } finally {
      if (requestIdRef.current === requestId) setIsSearching(false);
    }
  };

  return {
    input,
    setInput,
    results,
    selected,
    setSelected,
    requirement,
    setRequirement,
    isSearching,
    hasSearched,
    hasMoreResults,
    error,
    linkedSuccess,
    setLinkedSuccess,
    run,
    clearAfterLink,
  };
};

const SearchResults = ({ search }: { search: SearchState }) => {
  const { t } = useTranslation('study');
  if (search.isSearching) return null;
  if (search.results.length === 0) {
    return search.hasSearched ? (
      <p className="text-sm text-gray-600">{t('learningPath.noMatches')}</p>
    ) : null;
  }

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
      {search.results.map((result) => (
        <li key={result.id}>
          <button
            type="button"
            onClick={() => {
              search.setSelected(result);
              search.setRequirement(defaultUnlockRequirement(result));
              search.setLinkedSuccess(false);
            }}
            className={`w-full rounded-xl border px-3 py-2 text-left ${
              search.selected?.id === result.id
                ? 'border-navy bg-sky-50'
                : 'border-gray-200 hover:border-navy/40'
            }`}
          >
            <span className="block break-words text-sm font-semibold text-navy">
              {cardDisplayText(result)}
            </span>
            {cardMeaning(result) ? (
              <span className="block break-words text-xs text-gray-600">{cardMeaning(result)}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
};

const SuccessorConfirmation = ({
  card,
  currentCardId,
  search,
}: {
  card: StudyCardSummary;
  currentCardId: string;
  search: SearchState;
}) => {
  const { t } = useTranslation('study');
  const linkMutation = useLinkStudyLearningPathSuccessor();
  const { selected } = search;
  if (!selected) return null;

  const link = async () => {
    search.setLinkedSuccess(false);
    try {
      await linkMutation.mutateAsync({
        cardId: currentCardId,
        successorCardId: canonicalCardId(selected),
        unlockRequirement: search.requirement,
      });
      search.clearAfterLink();
    } catch {
      // The mutation error is rendered below.
    }
  };

  return (
    <>
      <div className="space-y-2 rounded-xl border border-navy/20 bg-cream/50 p-3">
        <p className="text-sm text-gray-700">
          {t('learningPath.confirm', {
            current: cardDisplayText(card),
            next: cardDisplayText(selected),
            requirement: t(`learningPath.requirement.${search.requirement}`),
          })}
        </p>
        <div>
          <label
            htmlFor={`learning-path-requirement-${card.id}`}
            className="block text-sm font-medium text-navy"
          >
            {t('learningPath.requirementLabel')}
          </label>
          <select
            id={`learning-path-requirement-${card.id}`}
            value={search.requirement}
            onChange={(event) =>
              search.setRequirement(event.target.value as StudyLearningPathUnlockRequirement)
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
            {t(`learningPath.requirementHelp.${search.requirement}`)}
          </span>
        </div>
        <button
          type="button"
          onClick={link}
          disabled={linkMutation.isPending}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {linkMutation.isPending ? t('learningPath.linking') : t('learningPath.linkNext')}
        </button>
      </div>
      {linkMutation.isError ? (
        <p className="text-sm text-red-600">
          {linkMutation.error instanceof Error
            ? linkMutation.error.message
            : t('learningPath.linkFailed')}
        </p>
      ) : null}
    </>
  );
};

const SuccessorSearch = ({
  card,
  currentCardId,
  search,
}: {
  card: StudyCardSummary;
  currentCardId: string;
  search: SearchState;
}) => {
  const { t } = useTranslation('study');
  return (
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
            value={search.input}
            onChange={(event) => search.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              search.run();
            }}
            placeholder={t('learningPath.searchPlaceholder')}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </label>
        <button
          type="button"
          onClick={search.run}
          disabled={!search.input.trim() || search.isSearching}
          className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {search.isSearching ? t('learningPath.searching') : t('learningPath.findCard')}
        </button>
      </div>
      {search.error ? <p className="text-sm text-red-600">{search.error}</p> : null}
      <SearchResults search={search} />
      {!search.isSearching && search.hasMoreResults ? (
        <p className="text-xs text-gray-500">{t('learningPath.moreMatches')}</p>
      ) : null}
      <SuccessorConfirmation card={card} currentCardId={currentCardId} search={search} />
    </div>
  );
};

const LearningPathContent = ({
  card,
  currentCardId,
  pathQuery,
  search,
}: {
  card: StudyCardSummary;
  currentCardId: string;
  pathQuery: LearningPathQuery;
  search: SearchState;
}) => {
  const { t } = useTranslation('study');
  if (!pathQuery.data) return null;

  const tailStage = pathQuery.data.stages.at(-1) ?? null;
  const isTail =
    pathQuery.data.stages.length === 0 ||
    Boolean(tailStage?.cards.some((item) => item.id === currentCardId));
  const tailCard = tailStage?.cards.at(-1) ?? null;

  return (
    <>
      <PathStages stages={pathQuery.data.stages} currentCardId={currentCardId} />
      {search.linkedSuccess ? (
        <p
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-medium text-green-700"
        >
          {t('learningPath.linked')}
        </p>
      ) : null}
      {!isTail && tailCard ? <TailOnlyNotice tailCard={tailCard} /> : null}
      {isTail ? (
        <SuccessorSearch card={card} currentCardId={currentCardId} search={search} />
      ) : null}
    </>
  );
};

const StudyLearningPathEditor = ({ card }: StudyLearningPathEditorProps) => {
  const { t } = useTranslation('study');
  const currentCardId = canonicalCardId(card);
  const pathQuery = useStudyLearningPath({ cardId: currentCardId, enabled: true });
  const pathCardIds = useMemo(
    () => new Set(pathQuery.data?.stages.flatMap((stage) => stage.cards.map((item) => item.id))),
    [pathQuery.data]
  );
  const search = useSuccessorSearch(currentCardId, pathCardIds);

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
      <PathQueryStatus pathQuery={pathQuery} />
      <LearningPathContent
        card={card}
        currentCardId={currentCardId}
        pathQuery={pathQuery}
        search={search}
      />
    </section>
  );
};

export default StudyLearningPathEditor;
