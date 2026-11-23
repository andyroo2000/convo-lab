import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { Ellipsis, Pencil } from 'lucide-react';
import { useRef } from 'react';
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
  const menuRef = useRef<HTMLDetailsElement>(null);
  const runMenuAction = (action: () => void) => {
    if (menuRef.current) menuRef.current.open = false;
    action();
  };

  return (
    <div className="min-w-0">
      <div data-testid="study-review-actions" className="study-session-actions">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="study-session-tool"
          aria-label={t('reviewActions.edit')}
        >
          <Pencil size={20} aria-hidden="true" />
        </button>
        <details ref={menuRef} className="study-session-menu">
          <summary className="study-session-tool" aria-label={t('reviewActions.more')}>
            <Ellipsis size={22} aria-hidden="true" />
          </summary>
          <div className="study-session-menu-items">
            <button
              type="button"
              onClick={() => runMenuAction(onBury)}
              disabled={disabled}
              className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {t('reviewActions.bury')}
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onToggleSuspend)}
              disabled={disabled}
              className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {card.state.queueState === 'suspended'
                ? t('reviewActions.unsuspend')
                : t('reviewActions.suspend')}
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onForget)}
              disabled={disabled}
              className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {t('reviewActions.forget')}
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onToggleSetDue)}
              disabled={disabled}
              className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {t('reviewActions.setDue')}
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onOpenBrowse)}
              disabled={disabled}
              className="app-button-secondary min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {t('reviewActions.openBrowse')}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};

export default StudyReviewActions;
