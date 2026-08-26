import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

interface StudyReviewActionsProps {
  card: StudyCardSummary;
  disabled?: boolean;
  onEdit: () => void;
  onBury: () => void;
  onToggleSuspend: () => void;
  onForget: () => void;
  onToggleSetDue: () => void;
  onOpenBrowse: () => void;
}

const StudyReviewActions = ({
  card,
  disabled = false,
  onEdit,
  onBury,
  onToggleSuspend,
  onForget,
  onToggleSetDue,
  onOpenBrowse,
}: StudyReviewActionsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="min-w-0">
      <div
        data-testid="study-review-actions"
        className="flex w-full gap-1.5 overflow-x-auto pb-0.5"
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {t('reviewActions.edit')}
        </button>
        <button
          type="button"
          onClick={onBury}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {t('reviewActions.bury')}
        </button>
        <button
          type="button"
          onClick={onToggleSuspend}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {card.state.queueState === 'suspended'
            ? t('reviewActions.unsuspend')
            : t('reviewActions.suspend')}
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {t('reviewActions.forget')}
        </button>
        <button
          type="button"
          onClick={onToggleSetDue}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {t('reviewActions.setDue')}
        </button>
        <button
          type="button"
          onClick={onOpenBrowse}
          disabled={disabled}
          className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
        >
          {t('reviewActions.openBrowse')}
        </button>
      </div>
    </div>
  );
};

export default StudyReviewActions;
