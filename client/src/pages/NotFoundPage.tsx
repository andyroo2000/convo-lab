import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft, Search } from 'lucide-react';
import Logo from '../components/common/Logo';

export default function NotFoundPage() {
  const { t } = useTranslation(['notFound']);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-soft-sand flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl font-bold text-navy">ConvoLab</span>
          <Logo size="medium" />
        </div>

        {/* 404 Message */}
        <div className="bg-white rounded-2xl shadow-lg p-12 border border-gray-200">
          <div className="mb-6">
            <h1 className="text-9xl font-bold text-indigo mb-4">404</h1>
            <h2 className="text-3xl font-bold text-navy mb-3">{t('notFound:title')}</h2>
            <p className="text-gray-600 text-lg">{t('notFound:description')}</p>
          </div>

          {/* Decorative Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 bg-purple-50 rounded-full flex items-center justify-center">
                <Search className="w-16 h-16 text-purple-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
                <span className="text-xl">?</span>
              </div>
            </div>
          </div>

          {/* Helpful Suggestions */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {t('notFound:suggestions.title')}
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-indigo mt-0.5">•</span>
                <span>{t('notFound:suggestions.checkUrl')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo mt-0.5">•</span>
                <span>{t('notFound:suggestions.returnHome')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo mt-0.5">•</span>
                <span>{t('notFound:suggestions.useNavigation')}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="btn-outline flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('notFound:buttons.goBack')}
            </button>
            <button
              onClick={() => navigate('/app/library')}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              {t('notFound:buttons.goToLibrary')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
