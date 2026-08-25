import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { StudyMilestoneList } from '../components/study/StudyMilestoneViews';
import {
  getStudyMilestoneDefinition,
  StudyMilestoneStore,
} from '../components/study/studyMilestoneModel';
import { evaluateStudyMilestones } from '../lib/studyMilestoneApi';

const StudyMilestonesPage = () => {
  const { t } = useTranslation('study');
  const { user } = useAuth();
  const store = useMemo(
    () => (user ? new StudyMilestoneStore(window.localStorage, user.id) : null),
    [user]
  );
  const [earnedAwards, setEarnedAwards] = useState(() => store?.earnedAwards ?? []);

  useEffect(() => {
    setEarnedAwards(store?.earnedAwards ?? []);
    if (!store) return undefined;

    let cancelled = false;
    evaluateStudyMilestones()
      .then((snapshot) => {
        if (cancelled) return;
        store.applyServerSnapshot(snapshot);
        setEarnedAwards(store.earnedAwards);
      })
      .catch(() => {
        // Keep the locally cached server snapshot available while offline.
      });

    return () => {
      cancelled = true;
    };
  }, [store]);

  const earnedDefinitions = earnedAwards.map(({ id }) => getStudyMilestoneDefinition(id));
  const earnedIds = new Set(earnedAwards.map(({ id }) => id));
  const upcomingDefinitions =
    store?.upcomingMilestones.filter(({ id }) => !earnedIds.has(id)) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-7 pb-8">
      <header className="flex items-center gap-3">
        <Link
          to="/app/study"
          className="grid size-10 place-items-center rounded-full border border-gray-300 bg-white text-navy hover:bg-gray-50"
          aria-label={t('milestones.back')}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="text-3xl font-black text-navy">{t('milestones.title')}</h1>
      </header>

      <StudyMilestoneList title={t('milestones.earned')} definitions={earnedDefinitions} earned />
      <StudyMilestoneList
        title={t('milestones.ahead')}
        definitions={upcomingDefinitions}
        earned={false}
      />
    </div>
  );
};

export default StudyMilestonesPage;
