import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import StudyBrowseDetail from '../components/study/browse/StudyBrowseDetail';
import StudyBrowseFilters from '../components/study/browse/StudyBrowseFilters';
import StudyBrowseNoteList from '../components/study/browse/StudyBrowseNoteList';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import useStudyBrowseController from '../hooks/useStudyBrowseController';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';

const StudyBrowsePage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const controller = useStudyBrowseController(isFeatureEnabled('flashcardsEnabled'));
  const capabilitiesQuery = useStudyCapabilities(isFeatureEnabled('flashcardsEnabled'));
  const hasSelection = Boolean(controller.selectedNoteId);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [hasSelection]);

  return (
    <div className="app-browse-page space-y-4">
      <section className="card app-surface px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              {t(hasSelection ? 'browse.detailTitle' : 'browse.title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 sm:text-base">
              {t(hasSelection ? 'browse.detailDescription' : 'browse.description')}
            </p>
          </div>
          {hasSelection ? (
            <button
              type="button"
              onClick={controller.showNoteList}
              className="app-button-secondary gap-1.5 xl:hidden"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('browse.backToList')}
            </button>
          ) : null}
          <Link
            to="/app/study/cards"
            className={`app-button-secondary gap-1.5 ${hasSelection ? 'hidden xl:inline-flex' : ''}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t('browse.back')}
          </Link>
        </div>
      </section>

      <div className={hasSelection ? 'hidden xl:block' : undefined}>
        <StudyBrowseFilters controller={controller} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(24rem,34rem)_minmax(0,1fr)]">
        <div className={`min-w-0 ${hasSelection ? 'hidden xl:block' : ''}`}>
          <StudyBrowseNoteList controller={controller} />
        </div>
        <div className={`min-w-0 ${hasSelection ? '' : 'hidden xl:block'}`}>
          <StudyBrowseDetail
            controller={controller}
            cardAuthoringCapabilities={capabilitiesQuery.data?.cardAuthoring}
          />
        </div>
      </section>
    </div>
  );
};

export default StudyBrowsePage;
