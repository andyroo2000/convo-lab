import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal } from 'lucide-react';

import type { StudyBrowserQuery } from '../../../lib/studyBrowseApi';
import type { StudyBrowseController } from '../../../hooks/useStudyBrowseController';
import StudyFormField from '../StudyFormField';

const SORT_FIELDS = [
  'created_on',
  'updated_on',
  'sort_field',
  'note_type',
  'card_count',
  'review_count',
] as const;

interface StudyBrowseFiltersProps {
  controller: StudyBrowseController;
}

const StudyBrowseFilters = ({ controller }: StudyBrowseFiltersProps) => {
  const { t } = useTranslation('study');
  const {
    browserData,
    query,
    searchInput,
    setCardType,
    setNoteType,
    setQueueState,
    setSearchInput,
    setSortDirection,
    setSortField,
    submitSearch,
  } = controller;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  return (
    <section className="card app-surface p-4 sm:p-5">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-end gap-2">
          <StudyFormField
            htmlFor="study-browser-search"
            label={t('browse.searchLabel')}
            className="min-w-0 flex-1"
          >
            <input
              id="study-browser-search"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('browse.searchPlaceholder')}
              className="app-form-control block w-full"
            />
          </StudyFormField>

          <button
            type="submit"
            aria-label={t('browse.search')}
            className="app-button-primary shrink-0 gap-2 px-4"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('browse.search')}</span>
            <span className="sr-only sm:hidden">{t('browse.search')}</span>
          </button>
        </div>

        <details className="group border-t border-navy/10 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-navy/30">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t('browse.filters')}
            </span>
            <span className="text-xs font-normal text-gray-500 group-open:hidden">
              {t('browse.showFilters')}
            </span>
            <span className="hidden text-xs font-normal text-gray-500 group-open:inline">
              {t('browse.hideFilters')}
            </span>
          </summary>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StudyFormField
              htmlFor="study-browser-note-type"
              label={t('browse.noteType')}
              className="min-w-0"
            >
              <select
                id="study-browser-note-type"
                value={query.noteType ?? ''}
                onChange={(event) => setNoteType(event.target.value)}
                className="app-form-control block w-full"
              >
                <option value="">{t('browse.allNoteTypes')}</option>
                {(browserData?.filterOptions.noteTypes ?? []).map((noteType) => (
                  <option key={noteType} value={noteType}>
                    {noteType}
                  </option>
                ))}
              </select>
            </StudyFormField>

            <StudyFormField
              htmlFor="study-browser-card-type"
              label={t('browse.cardType')}
              className="min-w-0"
            >
              <select
                id="study-browser-card-type"
                value={query.cardType ?? ''}
                onChange={(event) =>
                  setCardType(event.target.value as StudyBrowserQuery['cardType'] | '')
                }
                className="app-form-control block w-full"
              >
                <option value="">{t('browse.allCardTypes')}</option>
                {(browserData?.filterOptions.cardTypes ?? []).map((cardType) => (
                  <option key={cardType} value={cardType}>
                    {cardType}
                  </option>
                ))}
              </select>
            </StudyFormField>

            <StudyFormField
              htmlFor="study-browser-queue"
              label={t('browse.queueState')}
              className="min-w-0"
            >
              <select
                id="study-browser-queue"
                value={query.queueState ?? ''}
                onChange={(event) =>
                  setQueueState(event.target.value as StudyBrowserQuery['queueState'] | '')
                }
                className="app-form-control block w-full"
              >
                <option value="">{t('browse.allQueueStates')}</option>
                {(browserData?.filterOptions.queueStates ?? []).map((queueState) => (
                  <option key={queueState} value={queueState}>
                    {queueState}
                  </option>
                ))}
              </select>
            </StudyFormField>

            <StudyFormField
              htmlFor="study-browser-sort-field"
              label={t('browse.sortBy')}
              className="min-w-0"
            >
              <select
                id="study-browser-sort-field"
                value={query.sortField ?? 'created_on'}
                onChange={(event) =>
                  setSortField(event.target.value as NonNullable<StudyBrowserQuery['sortField']>)
                }
                className="app-form-control block w-full"
              >
                {SORT_FIELDS.map((sortField) => (
                  <option key={sortField} value={sortField}>
                    {t(`browse.sortFields.${sortField}`)}
                  </option>
                ))}
              </select>
            </StudyFormField>

            <StudyFormField
              htmlFor="study-browser-sort-direction"
              label={t('browse.sortDirection')}
              className="min-w-0"
            >
              <select
                id="study-browser-sort-direction"
                value={query.sortDirection ?? 'desc'}
                onChange={(event) =>
                  setSortDirection(
                    event.target.value as NonNullable<StudyBrowserQuery['sortDirection']>
                  )
                }
                className="app-form-control block w-full"
              >
                {(['desc', 'asc'] as const).map((sortDirection) => (
                  <option key={sortDirection} value={sortDirection}>
                    {t(`browse.sortDirections.${sortDirection}`)}
                  </option>
                ))}
              </select>
            </StudyFormField>
          </div>
        </details>
      </form>
    </section>
  );
};

export default StudyBrowseFilters;
