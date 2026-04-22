import { useEffect, useState } from 'react';
import type { StudyReviewEvent } from '@languageflow/shared/src/types';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import StudyFormField from '../components/study/StudyFormField';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyCardOptions, useStudyHistoryPage } from '../hooks/useStudy';

const StudyHistoryPage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [events, setEvents] = useState<StudyReviewEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const cardOptionsQuery = useStudyCardOptions(enabled, 100);
  const historyQuery = useStudyHistoryPage(enabled, {
    cardId: selectedCardId || undefined,
    cursor,
    limit: 50,
  });

  useEffect(() => {
    setEvents([]);
    setCursor(undefined);
  }, [selectedCardId]);

  useEffect(() => {
    if (!historyQuery.data) return;

    setEvents((current) => {
      if (!cursor) {
        return historyQuery.data.events;
      }

      const seen = new Set(current.map((event) => event.id));
      const appended = historyQuery.data.events.filter((event) => !seen.has(event.id));
      return [...current, ...appended];
    });
  }, [cursor, historyQuery.data]);

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-4xl">
        <h1 className="text-3xl font-bold text-navy mb-3">{t('history.title')}</h1>
        <p className="text-gray-600">{t('history.description')}</p>
      </section>

      <section className="card retro-paper-panel max-w-4xl space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <StudyFormField
            htmlFor="study-history-card"
            label={t('history.filterByCard')}
            className="flex-1 min-w-[16rem]"
          >
            <select
              id="study-history-card"
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">{t('history.allCards')}</option>
              {(cardOptionsQuery.data?.options ?? []).map((card) => (
                <option key={card.id} value={card.id}>
                  {card.label}
                </option>
              ))}
            </select>
          </StudyFormField>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('history.back')}
          </Link>
        </div>

        {cardOptionsQuery.data &&
        cardOptionsQuery.data.total > cardOptionsQuery.data.options.length ? (
          <p className="text-sm text-gray-500">
            {t('history.showingOptions', {
              shown: cardOptionsQuery.data.options.length,
              total: cardOptionsQuery.data.total,
            })}
          </p>
        ) : null}

        {historyQuery.isLoading && events.length === 0 ? (
          <p className="text-gray-500">{t('history.loading')}</p>
        ) : null}
        {historyQuery.error ? (
          <p className="text-red-600">
            {historyQuery.error instanceof Error ? historyQuery.error.message : t('history.failed')}
          </p>
        ) : null}

        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-gray-200 bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">{event.source}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  {new Date(event.reviewedAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-sm text-gray-700">
                {t('history.rating')} <span className="font-semibold">{event.rating}</span>
                {event.sourceReviewId ? (
                  <span className="ml-3 text-gray-500">
                    {t('history.ankiRevlogId', { id: event.sourceReviewId })}
                  </span>
                ) : null}
              </p>
            </article>
          ))}

          {!historyQuery.isLoading && events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
              {t('history.empty')}
            </div>
          ) : null}

          {historyQuery.data?.nextCursor ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCursor(historyQuery.data?.nextCursor ?? undefined)}
                disabled={historyQuery.isLoading}
                className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {historyQuery.isLoading ? t('history.loadingMore') : t('history.loadMore')}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default StudyHistoryPage;
