import { X, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuotaLimitPromptProps {
  onClose: () => void;
  quotaUsed: number;
  quotaLimit: number;
}

const QuotaLimitPrompt = ({ onClose, quotaUsed, quotaLimit }: QuotaLimitPromptProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-navy p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            aria-label={t('quotaLimitPrompt.close')}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Clock3 className="w-8 h-8" />
            <h2 className="text-2xl font-bold">{t('quotaLimitPrompt.title')}</h2>
          </div>
        </div>

        <div className="p-6">
          <p className="text-dark-brown mb-3">
            {t('quotaLimitPrompt.usage', { used: quotaUsed, limit: quotaLimit })}
          </p>
          <p className="text-medium-brown mb-6">{t('quotaLimitPrompt.reset')}</p>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            {t('quotaLimitPrompt.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotaLimitPrompt;
