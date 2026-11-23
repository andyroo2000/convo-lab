import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { Ellipsis, Pencil } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import useStudyActionMenu from './useStudyActionMenu';

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
  const menu = useStudyActionMenu(disabled);
  const menuId = useId();
  const runMenuAction = (action: () => void) => {
    menu.close();
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
        <div ref={menu.rootRef} className="study-session-menu" data-study-action-menu>
          <button
            type="button"
            ref={menu.triggerRef}
            className="study-session-tool"
            aria-label={t('reviewActions.more')}
            aria-expanded={menu.open}
            aria-controls={menuId}
            disabled={disabled}
            onClick={menu.toggle}
          >
            <Ellipsis size={22} aria-hidden="true" />
          </button>
          {menu.open ? (
            <div id={menuId} className="study-session-menu-items">
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
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StudyReviewActions;
