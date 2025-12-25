import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CourseGenerator from '../components/courses/CourseGenerator';

const CourseCreatorPage = () => {
  const _navigate = useNavigate();
  const { t } = useTranslation(['audioCourse']);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-coral">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">{t('audioCourse:pageTitle')}</h1>
        <p className="text-xl text-gray-600">{t('audioCourse:pageSubtitle')}</p>
      </div>

      <CourseGenerator />
    </div>
  );
};

export default CourseCreatorPage;
