import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';

const DialogueCreatorPage = () => {
  const { t } = useTranslation(['dialogue']);
  const _navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-periwinkle">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">{t('dialogue:pageTitle')}</h1>
        <p className="text-xl text-gray-600">{t('dialogue:pageSubtitle')}</p>
      </div>

      <DialogueGenerator />
    </div>
  );
};

export default DialogueCreatorPage;
