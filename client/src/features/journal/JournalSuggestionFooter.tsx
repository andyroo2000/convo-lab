import { Check, Undo2 } from 'lucide-react';
import type { JournalSegment } from './types';

interface Props {
  kind: JournalSegment['kind'];
  action: { applied: boolean; disabled: boolean; toggle: () => Promise<boolean> };
  close: () => void;
}

function actionLabel(kind: JournalSegment['kind'], applied: boolean) {
  if (kind === 'correction') return applied ? 'Reject correction' : 'Apply correction';
  return applied ? 'Undo suggestion' : 'Apply suggestion';
}

const JournalSuggestionFooter = ({ kind, action, close }: Props) => {
  const Icon = action.applied ? Check : Undo2;
  const style = action.applied
    ? 'border-[#e5e7e5] bg-transparent text-inherit dark:border-[#455055]'
    : 'border-[#347b9b] bg-[#347b9b] text-white dark:border-[#80c0dd] dark:bg-[#80c0dd] dark:text-[#172d3d]';
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7e5] pt-3 dark:border-[#455055]">
      <span
        role="status"
        className="flex items-center gap-1.5 text-xs text-[#65727b] dark:text-[#abb8c0]"
      >
        <Icon size={14} aria-hidden="true" />
        {action.applied ? 'Applied' : 'Original kept'}
      </span>
      <button
        type="button"
        disabled={action.disabled}
        className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-40 ${style}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
        }}
        onClick={() => {
          action.toggle().catch(() => undefined);
        }}
      >
        {actionLabel(kind, action.applied)}
      </button>
    </div>
  );
};

export default JournalSuggestionFooter;
