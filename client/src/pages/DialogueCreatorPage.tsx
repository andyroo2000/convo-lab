import { useTranslation } from 'react-i18next';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';

const DialogueCreatorPage = () => {
  const { t } = useTranslation(['dialogue']);

  return (
    <div className="retro-dialogue-create-v3-wrap">
      <div className="retro-dialogue-create-v3-shell">
        <div className="retro-dialogue-create-v3-top">
          <h1 className="retro-dialogue-create-v3-title">{t('dialogue:pageTitle')}</h1>
          <p className="retro-dialogue-create-v3-subtitle">{t('dialogue:pageSubtitle')}</p>
        </div>

        <div className="retro-dialogue-create-v3-main">
          <DialogueGenerator />
        </div>
      </div>
    </div>
  );
};

export default DialogueCreatorPage;
