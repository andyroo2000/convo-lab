import { useTranslation } from 'react-i18next';

interface DialogueGeneratingStateProps {
  generationError: string | null;
  requestError: string | null;
}

export const DialogueGeneratingState = ({
  generationError,
  requestError,
}: DialogueGeneratingStateProps) => {
  const { t } = useTranslation(['dialogue']);
  const displayedError = generationError || requestError;

  return (
    <div className="retro-dialogue-create-v3-generator">
      <div className="retro-dialogue-create-v3-state">
        <div className="loading-spinner retro-dialogue-create-v3-spinner" />
        <h2 className="retro-dialogue-create-v3-state-title">{t('dialogue:generating.title')}</h2>
        <p className="retro-dialogue-create-v3-state-copy">
          {t('dialogue:generating.description')}
        </p>
        {displayedError && (
          <div className="retro-dialogue-create-v3-alert is-error">{displayedError}</div>
        )}
      </div>
    </div>
  );
};

interface DialogueCompleteStateProps {
  courseError: string | null;
  generatedEpisodeId: string | null;
  hasConflictedCourseIntent: boolean;
  onOpenEpisode: (episodeId: string) => void;
  onAbandonConflictedCourseRequest: () => void;
}

export const DialogueCompleteState = ({
  courseError,
  generatedEpisodeId,
  hasConflictedCourseIntent,
  onOpenEpisode,
  onAbandonConflictedCourseRequest,
}: DialogueCompleteStateProps) => {
  const { t } = useTranslation(['dialogue']);

  return (
    <div className="retro-dialogue-create-v3-generator">
      <div className="retro-dialogue-create-v3-state">
        <div className="retro-dialogue-create-v3-check">
          <svg
            className="retro-dialogue-create-v3-check-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="retro-dialogue-create-v3-state-title">{t('dialogue:complete.title')}</h2>
        <p className="retro-dialogue-create-v3-state-copy">
          {courseError
            ? t('dialogue:complete.courseFailureSubtitle')
            : t('dialogue:complete.redirecting')}
        </p>
        {courseError && (
          <div className="retro-dialogue-create-v3-alert is-warning">
            <p className="retro-dialogue-create-v3-alert-title">
              {t('dialogue:complete.courseFailureTitle')}
            </p>
            <p className="retro-dialogue-create-v3-alert-copy">
              {t('dialogue:complete.courseFailureBody')}
            </p>
            <p className="retro-dialogue-create-v3-alert-detail">
              {t('dialogue:complete.courseFailureDetail', { message: courseError })}
            </p>
            {generatedEpisodeId && (
              <button
                type="button"
                className="retro-dialogue-create-v3-alert-btn"
                onClick={() => onOpenEpisode(generatedEpisodeId)}
              >
                {t('dialogue:complete.courseFailureCta')}
              </button>
            )}
            {hasConflictedCourseIntent && (
              <button
                type="button"
                className="retro-dialogue-create-v3-alert-btn"
                onClick={onAbandonConflictedCourseRequest}
              >
                Start a new request
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
