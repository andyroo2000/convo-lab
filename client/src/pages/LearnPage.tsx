import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { KnownKanjiProvider } from '../contexts/KnownKanjiContext';
import { getLearnCollection } from '../features/learn/learnApi';
import LearnHome from '../features/learn/LearnHome';
import LearnLessonWorkspace from '../features/learn/LearnLessonWorkspace';
import '../features/learn/learn.css';
import type { LearnCollection } from '../features/learn/types';

const LoadedLesson = ({
  data,
  lessonId,
  ownerId,
}: {
  data: LearnCollection;
  lessonId?: string;
  ownerId: string;
}) => {
  if (!lessonId) return <LearnHome {...data} />;
  const lesson = data.lessons.find((item) => item.id === lessonId);
  if (lesson)
    return (
      <LearnLessonWorkspace key={`${ownerId}:${lessonId}`} ownerId={ownerId} lesson={lesson} />
    );
  return (
    <div className="learn-paper">
      <h1>Lesson not found</h1>
      <Link to="/app/learn">Return to Chapter 1</Link>
    </div>
  );
};

const LearnPage = () => {
  const { user } = useAuth();
  const { lessonId } = useParams();
  const ownerId = String(user?.id ?? '');
  const query = useQuery({
    queryKey: ['learn-collection', ownerId],
    queryFn: ({ signal }) => getLearnCollection(signal),
    enabled: Boolean(user),
    retry: false,
  });
  return (
    <KnownKanjiProvider key={ownerId}>
      <div className="learn-app">
        {query.isPending && <p role="status">Opening your learning notebook…</p>}
        {query.isError && (
          <div className="learn-paper" role="alert">
            <p>Your learning notebook could not load.</p>
            <p>{query.error.message}</p>
            <button type="button" className="learn-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        )}
        {query.data && <LoadedLesson data={query.data} lessonId={lessonId} ownerId={ownerId} />}
      </div>
    </KnownKanjiProvider>
  );
};

export default LearnPage;
