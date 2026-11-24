import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import StudySpeakerIcon from './StudySpeakerIcon';
import { getStudyCardAudioUrl, getStudyCardPresentation } from './studyCardUtils';

import { StudyReplayMount } from './studyReplayContext';

const StudySessionReplay = ({
  card,
  revealed,
  reveal,
}: {
  card: StudyCardSummary;
  revealed: boolean;
  reveal: () => void;
}) => {
  const mount = useContext(StudyReplayMount);
  const { t } = useTranslation('study');
  const presentation = getStudyCardPresentation(card);
  const hasCue = presentation ? presentation.front.media.audio?.url : card.prompt.cueAudio?.url;
  const cloze = presentation ? presentation.front.mode === 'cloze' : card.cardType === 'cloze';
  const hearAnswer = !revealed && (cloze || !hasCue) && getStudyCardAudioUrl(card);
  return (
    <div ref={mount} className="study-replay-host">
      {hearAnswer && (
        <button type="button" onClick={reveal} className="study-toolbar-replay">
          <span className="study-replay-disc">
            <StudySpeakerIcon playing={false} />
          </span>
          {t('reviewHeader.hearAnswer')}
        </button>
      )}
    </div>
  );
};

export default StudySessionReplay;
