import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

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
    <section className="card retro-paper-panel space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
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
            onChange={(event) => setNoteType(event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
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
          className="min-w-[10rem]"
        >
          <select
            id="study-browser-card-type"
            value={query.cardType ?? ''}
            onChange={(event) =>
              setCardType(event.target.value as StudyBrowserQuery['cardType'] | '')
            }
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
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
          className="min-w-[10rem]"
        >
          <select
            id="study-browser-queue"
            value={query.queueState ?? ''}
            onChange={(event) =>
              setQueueState(event.target.value as StudyBrowserQuery['queueState'] | '')
            }
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
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
          className="min-w-[10rem]"
        >
          <select
            id="study-browser-sort-field"
            value={query.sortField ?? 'created_on'}
            onChange={(event) =>
              setSortField(event.target.value as NonNullable<StudyBrowserQuery['sortField']>)
            }
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
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
          className="min-w-[10rem]"
        >
          <select
            id="study-browser-sort-direction"
            value={query.sortDirection ?? 'desc'}
            onChange={(event) =>
              setSortDirection(
                event.target.value as NonNullable<StudyBrowserQuery['sortDirection']>
              )
            }
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          >
            {(['desc', 'asc'] as const).map((sortDirection) => (
              <option key={sortDirection} value={sortDirection}>
                {t(`browse.sortDirections.${sortDirection}`)}
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
  );
};

export default StudyBrowseFilters;
