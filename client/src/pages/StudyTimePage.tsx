import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import StudyTimeAnalyticsSection from '../components/study/StudyTimeAnalyticsSection';
import StudyTimeSessionSections from '../components/study/StudyTimeSessionSections';
import WeeklyStudyRecapCard from '../components/study/WeeklyStudyRecapCard';

const StudyTimePage = () => {
  const { t } = useTranslation(['study']);

  return (
    <div className="space-y-6">
      <header className="retro-paper-panel overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="retro-caps text-coral">{t('time.eyebrow')}</p>
            <h1 className="retro-headline text-5xl text-navy">{t('time.title')}</h1>
            <p className="mt-2 max-w-2xl text-gray-600">{t('time.description')}</p>
          </div>
          <TrendingUp className="hidden h-14 w-14 text-coral/70 sm:block" aria-hidden="true" />
        </div>
      </header>

      <StudyTimeAnalyticsSection />
      <WeeklyStudyRecapCard />
      <StudyTimeSessionSections />
    </div>
  );
};

export default StudyTimePage;
