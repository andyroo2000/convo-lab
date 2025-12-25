import { Eye, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImpersonationBannerProps {
  impersonatedUser: {
    name: string;
    email: string;
  };
  onExit: () => void;
}

const ImpersonationBanner = ({ impersonatedUser, onExit }: ImpersonationBannerProps) => {
  const { t } = useTranslation(['common']);

  return (
    <div className="bg-amber-500 text-white px-4 py-3 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {t('common:impersonation.viewingAs', { name: impersonatedUser.name })}
            </span>
            <span className="text-amber-100">({impersonatedUser.email})</span>
            <span className="px-2 py-0.5 bg-amber-600 text-amber-100 text-xs rounded-full">
              {t('common:impersonation.readOnly')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 bg-white text-amber-600 rounded-md hover:bg-amber-50 transition-colors font-medium"
        >
          <X className="w-4 h-4" />
          {t('common:impersonation.exitView')}
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
