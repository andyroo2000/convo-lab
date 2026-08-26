import { useTranslation } from 'react-i18next';

import JlptMasteryCard from '../components/study/JlptMasteryCard';
import StudyTimeAnalyticsSection from '../components/study/StudyTimeAnalyticsSection';
import StudyTimeSessionSections from '../components/study/StudyTimeSessionSections';
import WeeklyStudyRecapCard from '../components/study/WeeklyStudyRecapCard';

const StudyTimePage = () => {
  const { t } = useTranslation(['study']);

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <header className="card app-surface px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{t('time.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 sm:text-base">{t('time.description')}</p>
      </header>

      <StudyTimeAnalyticsSection />
      <WeeklyStudyRecapCard />
      <JlptMasteryCard />
      <StudyTimeSessionSections />
    </div>
  );
};

export default StudyTimePage;
