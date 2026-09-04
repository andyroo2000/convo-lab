import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import useStudyCardListQueries from '../hooks/useStudyCardListQueries';
import useStudyCardsQueue from '../hooks/useStudyCardsQueue';
import useStudyInfiniteScroll from '../hooks/useStudyInfiniteScroll';
import {
  AllCardsPanel,
  CardsSearch,
  CollectionTabs,
  QueuePanel,
  StudyCardsHeader,
  type StudyCardCollectionMode,
} from '../components/study/StudyCardsCollections';

const StudyCardsPage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [mode, setMode] = useState<StudyCardCollectionMode>('queue');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { learningItems, learningItemsQuery, queueQuery } = useStudyCardListQueries({
    enabled,
    mode,
    searchQuery,
  });
  const queue = useStudyCardsQueue(queueQuery.data);
  const queueTotal = queueQuery.data?.pages[0]?.total ?? queue.items.length;

  const queueSentinelRef = useStudyInfiniteScroll(
    mode === 'queue' && Boolean(queueQuery.hasNextPage) && !queueQuery.isFetchingNextPage,
    () => queueQuery.fetchNextPage()
  );
  const cardsSentinelRef = useStudyInfiniteScroll(
    mode === 'all' &&
      Boolean(learningItemsQuery.hasNextPage) &&
      !learningItemsQuery.isFetchingNextPage,
    () => learningItemsQuery.fetchNextPage()
  );

  if (!enabled) {
    return (
      <section className="card app-surface max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">{t('cards.title')}</h1>
        <p className="text-gray-600">{t('disabled')}</p>
      </section>
    );
  }

  return (
    <div className="ios-cards-page mx-auto max-w-4xl space-y-5">
      <StudyCardsHeader />
      <section className="card app-surface ios-cards-tray space-y-4">
        <CollectionTabs mode={mode} setMode={setMode} />
        {mode === 'all' ? (
          <CardsSearch
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchInput.trim());
            }}
          />
        ) : null}
        {mode === 'queue' ? (
          <QueuePanel
            queueTotal={queueTotal}
            items={queue.items}
            reorderDisabled={queue.reorderDisabled}
            selecting={queue.selecting}
            setSelecting={queue.setSelecting}
            selectedIds={queue.selectedIds}
            setSelectedIds={queue.setSelectedIds}
            lessonLabel={queue.label}
            setLessonLabel={queue.setLabel}
            isCreatingLesson={queue.isCreatingLesson}
            onStartLesson={queue.startLesson}
            onCancelLesson={queue.cancelLesson}
            onDragEnd={queue.handleDragEnd}
            isLoading={queueQuery.isLoading}
            queryError={queueQuery.error}
            queueError={queue.queueError}
            isFetchingNextPage={queueQuery.isFetchingNextPage}
            sentinelRef={queueSentinelRef}
          />
        ) : (
          <AllCardsPanel
            items={learningItems}
            isLoading={learningItemsQuery.isLoading}
            error={learningItemsQuery.error}
            searchQuery={searchQuery}
            isFetchingNextPage={learningItemsQuery.isFetchingNextPage}
            sentinelRef={cardsSentinelRef}
          />
        )}
      </section>
    </div>
  );
};

export default StudyCardsPage;
