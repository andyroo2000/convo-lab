import { useTranslation } from 'react-i18next';

import type { StudyBrowseController } from '../../../hooks/useStudyBrowseController';
import StudyScrollableListPanel from '../StudyScrollableListPanel';

interface StudyBrowseNoteListProps {
  controller: StudyBrowseController;
}

const StudyBrowseNoteList = ({ controller }: StudyBrowseNoteListProps) => {
  const { t } = useTranslation('study');
  const {
    browserData,
    browserError,
    isBrowserLoading,
    loadMore,
    query,
    rows,
    selectedNoteId,
    selectNote,
  } = controller;

  return (
    <StudyScrollableListPanel
      panelTestId="study-browser-note-list"
      scrollRegionTestId="study-browser-note-scroll-region"
      header={
        <p className="text-sm text-gray-600">
          {query.q
            ? t('browse.notesMatching', {
                count: browserData?.total ?? 0,
                query: query.q,
              })
            : t('browse.notesCount', { count: browserData?.total ?? 0 })}
        </p>
      }
      footer={
        <>
          <p className="text-sm text-gray-500">
            {t('browse.showing', {
              shown: rows.length,
              total: browserData?.total ?? 0,
            })}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <button
              type="button"
              disabled={!browserData?.nextCursor || isBrowserLoading}
              onClick={loadMore}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBrowserLoading && query.cursor ? t('browse.loadingMore') : t('browse.loadMore')}
            </button>
          </div>
        </>
      }
    >
      {isBrowserLoading ? <p className="p-6 text-gray-500">{t('browse.loadingNotes')}</p> : null}
      {browserError ? (
        <p className="p-6 text-red-600">
          {browserError instanceof Error ? browserError.message : t('browse.failedNotes')}
        </p>
      ) : null}

      {!isBrowserLoading && !rows.length ? (
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
                onClick={() => selectNote(row.noteId)}
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
              <thead className="sticky top-0 z-[1] bg-cream/95 text-gray-600">
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
                    onClick={() => selectNote(row.noteId)}
                  >
                    <td className="max-w-[16rem] px-4 py-3 align-top">
                      <p className="line-clamp-2 break-words text-gray-900">{row.displayText}</p>
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
    </StudyScrollableListPanel>
  );
};

export default StudyBrowseNoteList;
