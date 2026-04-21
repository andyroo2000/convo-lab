import { useState } from 'react';
import { Link } from 'react-router-dom';

import StudyFormField from '../components/study/StudyFormField';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyCardOptions, useStudyHistory } from '../hooks/useStudy';

const StudyHistoryPage = () => {
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const cardOptionsQuery = useStudyCardOptions(enabled, 100);
  const historyQuery = useStudyHistory(enabled, selectedCardId || undefined);

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-4xl">
        <h1 className="text-3xl font-bold text-navy mb-3">Study history</h1>
        <p className="text-gray-600">
          Review events stay immutable so imported Anki history and future ConvoLab reviews can be
          exported together later.
        </p>
      </section>

      <section className="card retro-paper-panel max-w-4xl space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <StudyFormField
            htmlFor="study-history-card"
            label="Filter by card"
            className="flex-1 min-w-[16rem]"
          >
            <select
              id="study-history-card"
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">All cards</option>
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
            Back to study
          </Link>
        </div>

        {cardOptionsQuery.data &&
        cardOptionsQuery.data.total > cardOptionsQuery.data.options.length ? (
          <p className="text-sm text-gray-500">
            Showing first {cardOptionsQuery.data.options.length} of {cardOptionsQuery.data.total}{' '}
            cards in the filter dropdown.
          </p>
        ) : null}

        {historyQuery.isLoading ? <p className="text-gray-500">Loading review history…</p> : null}
        {historyQuery.error ? (
          <p className="text-red-600">
            {historyQuery.error instanceof Error
              ? historyQuery.error.message
              : 'Failed to load history.'}
          </p>
        ) : null}

        <div className="space-y-3">
          {(historyQuery.data ?? []).map((event) => (
            <article key={event.id} className="rounded-2xl border border-gray-200 bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">{event.source}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  {new Date(event.reviewedAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-sm text-gray-700">
                Rating: <span className="font-semibold">{event.rating}</span>
                {event.sourceReviewId ? (
                  <span className="ml-3 text-gray-500">Anki revlog id: {event.sourceReviewId}</span>
                ) : null}
              </p>
            </article>
          ))}

          {!historyQuery.isLoading && (historyQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
              No review history yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default StudyHistoryPage;
