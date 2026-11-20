import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useAuth } from '../../contexts/AuthContext';
import './tutorNotFound.css';

const TutorNotFound = () => {
  const { t } = useTranslation('notFound');
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  return (
    <section className="tutor-not-found" aria-label={t('title')}>
      <h1 className="tutor-not-found-code">404 · {t('title')}</h1>
      <img
        className="tutor-not-found-avatar"
        src="/images/tutor-hana.webp"
        alt={t('tutor')}
        width={94}
        height={94}
      />
      <p className="tutor-not-found-label">{t('phraseLabel')}</p>
      <h2 className="tutor-not-found-phrase" lang="ja">
        <ruby>
          見<rt>み</rt>
        </ruby>
        つかりません。
      </h2>
      <p className="tutor-not-found-meaning" lang="en">
        “I can’t find it.”
      </p>
      <p className="tutor-not-found-copy">{t('tutorMessage')}</p>
      <div className="tutor-not-found-actions">
        <Link to="/app/journal" className="tutor-not-found-button">
          {t('buttons.goToJournal')}
        </Link>
        {user && isFeatureEnabled('flashcardsEnabled') && (
          <Link to="/app/study" className="tutor-not-found-button tutor-not-found-button--paper">
            {t('buttons.goToStudy')}
          </Link>
        )}
      </div>
    </section>
  );
};
export default TutorNotFound;
