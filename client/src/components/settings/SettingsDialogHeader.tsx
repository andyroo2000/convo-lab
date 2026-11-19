import { ArrowLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type SettingsEditor = 'profile' | 'security' | 'danger';

const SettingsDialogHeader = ({
  editor,
  nestedOverlay,
  back,
  close,
}: {
  editor: SettingsEditor | null;
  nestedOverlay: boolean;
  back: () => void;
  close: () => void;
}) => {
  const { t } = useTranslation('settings');
  const titleKey = editor ?? 'index';
  return (
    <header className="journal-settings-header">
      {editor && (
        <button type="button" aria-label={t('modal.back')} disabled={nestedOverlay} onClick={back}>
          <ArrowLeft aria-hidden="true" />
        </button>
      )}
      <div>
        <p>
          CONVO-LAB <span>コンボ・ラボ</span>
        </p>
        <h1 id="journal-settings-title">{t(`modal.titles.${titleKey}`)}</h1>
      </div>
      <button type="button" aria-label={t('modal.close')} disabled={nestedOverlay} onClick={close}>
        <X aria-hidden="true" />
      </button>
    </header>
  );
};
export default SettingsDialogHeader;
