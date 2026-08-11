import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import StudyBrowseDetail from '../components/study/browse/StudyBrowseDetail';
import StudyBrowseFilters from '../components/study/browse/StudyBrowseFilters';
import StudyBrowseNoteList from '../components/study/browse/StudyBrowseNoteList';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import useStudyBrowseController from '../hooks/useStudyBrowseController';

const StudyBrowsePage = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled } = useFeatureFlags();
  const controller = useStudyBrowseController(isFeatureEnabled('flashcardsEnabled'));

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">{t('browse.title')}</h1>
            <p className="text-gray-600">{t('browse.description')}</p>
          </div>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('browse.back')}
          </Link>
        </div>
      </section>

      <StudyBrowseFilters controller={controller} />

      <section className="grid gap-6 xl:grid-cols-[minmax(26rem,38rem)_minmax(0,1fr)]">
        <StudyBrowseNoteList controller={controller} />
        <StudyBrowseDetail controller={controller} />
      </section>
    </div>
  );
};

export default StudyBrowsePage;
