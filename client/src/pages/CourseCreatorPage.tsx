import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CourseGenerator from '../components/courses/CourseGenerator';

const CourseCreatorPage = () => {
  const { t } = useTranslation(['audioCourse']);
  const { episodeId } = useParams<{ episodeId: string }>();

  if (!episodeId) {
    return <Navigate to="/app/create/dialogue" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-coral">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">
          {t('audioCourse:pageTitleFromDialogue')}
        </h1>
        <p className="text-xl text-gray-600">{t('audioCourse:pageSubtitleFromDialogue')}</p>
      </div>

      <CourseGenerator episodeId={episodeId} />
    </div>
  );
};

export default CourseCreatorPage;
