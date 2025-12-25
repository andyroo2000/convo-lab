import { useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DemoRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DemoRestrictionModal = ({ isOpen, onClose }: DemoRestrictionModalProps) => {
  const { t } = useTranslation(['common']);
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fadeIn"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="button"
      tabIndex={-1}
      aria-label="Close modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-bold text-navy">{t('common:demo.title')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">{t('common:demo.description')}</p>
          <p className="text-gray-600 text-sm">{t('common:demo.contactAdmin')}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
          <button type="button" onClick={onClose} className="btn-primary flex-1">
            {t('common:modal.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoRestrictionModal;
