import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyExport, useStudyHistory } from '../hooks/useStudy';

const StudyHistoryPage = () => {
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const exportQuery = useStudyExport(enabled);
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
          <div className="flex-1 min-w-[16rem]">
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="study-history-card"
            >
              Filter by card
            </label>
            <select
              id="study-history-card"
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="">All cards</option>
              {(exportQuery.data?.cards ?? []).slice(0, 100).map((card) => (
                <option key={card.id} value={card.id}>
                  {card.cardType}:{' '}
                  {card.answer.expression ??
                    card.answer.restoredText ??
                    card.prompt.cueText ??
                    card.id}
                </option>
              ))}
            </select>
          </div>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            Back to study
          </Link>
        </div>

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
