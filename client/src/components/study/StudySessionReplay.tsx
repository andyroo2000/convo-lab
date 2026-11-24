import { useContext } from 'react';
import { StudyReplayMount } from './studyReplayContext';

const StudySessionReplay = () => {
  const mount = useContext(StudyReplayMount);
  return <div ref={mount} className="study-replay-host" />;
};

export default StudySessionReplay;
