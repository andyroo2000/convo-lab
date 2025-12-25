import { useNavigate } from 'react-router-dom';
import { X, Zap, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

interface UpgradePromptProps {
  onClose?: () => void;
  quotaUsed?: number;
  quotaLimit?: number;
}

export default function UpgradePrompt({ onClose, quotaUsed, quotaLimit }: UpgradePromptProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUpgrade = () => {
    navigate('/pricing');
    onClose?.();
  };

  const handleViewBilling = () => {
    navigate('/app/settings/billing');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-periwinkle to-dark-periwinkle p-6 text-white relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
              aria-label={t('upgradePrompt.buttons.close')}
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8" />
            <h2 className="text-2xl font-bold">{t('upgradePrompt.title')}</h2>
          </div>
          {quotaUsed !== undefined && quotaLimit !== undefined && (
            <p className="text-white text-opacity-90">
              {t('upgradePrompt.quotaUsed', { used: quotaUsed, limit: quotaLimit })}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {user?.tier === 'free' ? (
            <>
              <p className="text-dark-brown mb-6">{t('upgradePrompt.limitReached')}</p>

              <div className="bg-periwinkle-light border-2 border-periwinkle rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-dark-brown mb-4">
                  {t('upgradePrompt.proPlan.title')}
                </h3>
                <ul className="space-y-3 mb-4">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">{t('upgradePrompt.proPlan.features.0')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">{t('upgradePrompt.proPlan.features.1')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">{t('upgradePrompt.proPlan.features.2')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">{t('upgradePrompt.proPlan.features.3')}</span>
                  </li>
                </ul>
              </div>

              <button onClick={handleUpgrade} className="btn-primary w-full mb-3">
                {t('upgradePrompt.buttons.upgrade')}
              </button>

              {onClose && (
                <button onClick={onClose} className="btn-secondary w-full">
                  {t('upgradePrompt.buttons.maybeLater')}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-dark-brown mb-6">{t('upgradePrompt.resetInfo')}</p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-medium-brown mb-2">{t('upgradePrompt.proQuotaInfo')}</p>
                <p className="text-sm text-medium-brown">{t('upgradePrompt.quotaResetInfo')}</p>
              </div>

              <button onClick={handleViewBilling} className="btn-secondary w-full mb-3">
                {t('upgradePrompt.buttons.viewBilling')}
              </button>

              {onClose && (
                <button onClick={onClose} className="btn-secondary w-full">
                  {t('upgradePrompt.buttons.close')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
