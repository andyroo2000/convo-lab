import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft, Search } from 'lucide-react';
import Logo from '../components/common/Logo';

const NotFoundPage = () => {
  const { t } = useTranslation(['notFound']);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen retro-404-wrap flex items-center justify-center px-4 py-8">
      <div className="retro-404-shell max-w-5xl w-full">
        <div className="retro-404-top">
          <div className="retro-404-brand-row">
            <div className="retro-404-brand">
              <span className="retro-404-brand-en">ConvoLab</span>
              <span className="retro-404-brand-jp">コンボラボ</span>
            </div>
            <div className="retro-404-logo-mark">
              <Logo size="medium" />
            </div>
          </div>
          <h2 className="retro-404-headline">{t('notFound:title')}</h2>
          <p className="retro-404-copy">{t('notFound:description')}</p>
        </div>

        <div className="retro-404-main">
          <div className="retro-404-code-row">
            <h1 className="retro-404-code text-9xl">404</h1>
            <div className="retro-404-icon" aria-hidden="true">
              <Search className="h-10 w-10" />
            </div>
          </div>

          <div className="retro-404-suggestions">
            <h3 className="retro-404-suggestions-title">{t('notFound:suggestions.title')}</h3>
            <ul className="retro-404-suggestions-list">
              <li>
                <span className="retro-404-bullet">•</span>
                <span>{t('notFound:suggestions.checkUrl')}</span>
              </li>
              <li>
                <span className="retro-404-bullet">•</span>
                <span>{t('notFound:suggestions.returnHome')}</span>
              </li>
              <li>
                <span className="retro-404-bullet">•</span>
                <span>{t('notFound:suggestions.useNavigation')}</span>
              </li>
            </ul>
          </div>

          <div className="retro-404-actions">
            <button type="button" onClick={() => navigate(-1)} className="retro-404-btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              {t('notFound:buttons.goBack')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/library')}
              className="retro-404-btn-primary"
            >
              <Home className="w-4 h-4" />
              {t('notFound:buttons.goToLibrary')}
            </button>
          </div>
        </div>

        <div className="retro-404-foot retro-caps">FILE: CONVO-LAB-V3 | PAGE: NOT FOUND</div>
      </div>
    </div>
  );
};

export default NotFoundPage;
