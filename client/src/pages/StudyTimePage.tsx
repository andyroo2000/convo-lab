import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import JlptMasteryCard from '../components/study/JlptMasteryCard';
import StudyTimeAnalyticsSection from '../components/study/StudyTimeAnalyticsSection';
import StudyTimeSessionSections from '../components/study/StudyTimeSessionSections';
import WeeklyStudyRecapCard from '../components/study/WeeklyStudyRecapCard';
import './studyTimeRecord.css';

const tabs = ['rhythm', 'recap', 'mastery', 'entries'] as const;
type Tab = (typeof tabs)[number];

function navigateTabs(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  select: (tab: Tab) => void
) {
  const destination: Record<string, number> = {
    ArrowRight: (index + 1) % tabs.length,
    ArrowLeft: (index + tabs.length - 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };
  const next = destination[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const name = tabs[next];
  document.getElementById(`time-tab-${name}`)?.focus();
  select(name);
}

const StudyTimePage = () => {
  const { t } = useTranslation(['study']);
  const [tab, setTab] = useState<Tab>('rhythm');
  const [logging, setLogging] = useState(false);
  const [visitedEntries, setVisitedEntries] = useState(false);

  const select = (next: Tab) => {
    setTab(next);
    if (next === 'entries') setVisitedEntries(true);
  };
  const logFormVisible = tab === 'entries' && logging;
  const logTime = () => {
    select('entries');
    setLogging(!logFormVisible);
  };

  const record = (controls: ReactNode, rhythm: ReactNode) => {
    const panels = {
      rhythm,
      recap: <WeeklyStudyRecapCard />,
      mastery: <JlptMasteryCard />,
      entries: <StudyTimeSessionSections logging={logging} />,
    };
    return (
      <>
        {controls}
        <div className="time-paper">
          <div className="time-tabs" role="tablist" aria-label={t('time.title')}>
            {tabs.map((name, index) => (
              <button
                type="button"
                key={name}
                id={`time-tab-${name}`}
                role="tab"
                aria-controls={`time-panel-${name}`}
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => select(name)}
                onKeyDown={(event) => navigateTabs(event, index, select)}
              >
                {t(`time.tabs.${name}`)}
              </button>
            ))}
          </div>
          {tabs.map((name) => (
            <div
              key={name}
              role="tabpanel"
              id={`time-panel-${name}`}
              aria-labelledby={`time-tab-${name}`}
              hidden={tab !== name}
              tabIndex={tab === name ? 0 : -1}
            >
              {(tab === name || (name === 'entries' && visitedEntries)) && panels[name]}
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="time-record">
      <header className="time-title">
        <h1>{t('time.title')}</h1>
        <button
          type="button"
          className="time-log"
          aria-expanded={logFormVisible}
          aria-controls="time-panel-entries"
          onClick={logTime}
        >
          <span aria-hidden="true">{logFormVisible ? '− ' : '＋ '}</span>
          {t(logFormVisible ? 'time.closeLog' : 'time.logTime')}
        </button>
      </header>
      <StudyTimeAnalyticsSection showRhythm={() => select('rhythm')}>
        {record}
      </StudyTimeAnalyticsSection>
    </div>
  );
};

export default StudyTimePage;
