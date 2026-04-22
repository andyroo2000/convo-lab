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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        data-testid="study-review-actions"
        className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap"
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('reviewActions.edit')}
        </button>
        <button
          type="button"
          onClick={onBury}
          disabled={disabled}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('reviewActions.bury')}
        </button>
        <button
          type="button"
          onClick={onToggleSuspend}
          disabled={disabled}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {card.state.queueState === 'suspended'
            ? t('reviewActions.unsuspend')
            : t('reviewActions.suspend')}
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={disabled}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('reviewActions.forget')}
        </button>
        <button
          type="button"
          onClick={onToggleSetDue}
          disabled={disabled}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('reviewActions.setDue')}
        </button>
        <button
          type="button"
          onClick={onOpenBrowse}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
        >
          {t('reviewActions.openBrowse')}
        </button>
      </div>
    </div>
  );
};

export default StudyReviewActions;
