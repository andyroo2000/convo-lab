import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import useJournalPopover from './useJournalPopover';
import JournalDeleteDialog from './JournalDeleteDialog';
import JournalRenameDialog from './JournalRenameDialog';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface Props {
  entry: Archive['entries'][number];
  disabled?: boolean;
  remove: Archive['remove'];
  rename: Archive['rename'];
  snapshot: Archive['snapshot'];
  onDeleted: (id: string) => void;
  onRenamed: (id: string) => void;
}

function menuKey(event: KeyboardEvent<HTMLDivElement>, dismiss: () => void) {
  if (event.key === 'Escape') {
    event.preventDefault();
    dismiss();
    return;
  }
  const buttons = [...event.currentTarget.querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = {
    ArrowDown: (index + 1) % buttons.length,
    ArrowUp: (index + buttons.length - 1) % buttons.length,
    Home: 0,
    End: buttons.length - 1,
  }[event.key];
  if (next !== undefined) {
    event.preventDefault();
    buttons[next]?.focus();
  }
}

function useRowActions(entry: Props['entry'], snapshot: Props['snapshot']) {
  const popover = useJournalPopover();
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'delete'; entry: Props['entry'] } | null>(
    null
  );
  const [error, setError] = useState('');
  useEffect(() => {
    if (popover.open) popover.popup.current?.querySelector('button')?.focus();
  }, [popover.open, popover.popup]);
  function dismiss() {
    popover.close();
    popover.anchor.current?.focus();
  }
  function choose(kind: 'rename' | 'delete') {
    dismiss();
    try {
      setDialog({ kind, entry: snapshot(entry) });
      setError('');
    } catch {
      setError('Could not read this draft. Please try again.');
    }
  }
  return { popover, dialog, error, choose, dismiss, setDialog };
}

const RowDialog = ({
  dialog,
  remove,
  rename,
  onDeleted,
  onRenamed,
  onCancel,
}: Pick<Props, 'remove' | 'rename' | 'onDeleted' | 'onRenamed'> & {
  dialog: ReturnType<typeof useRowActions>['dialog'];
  onCancel: () => void;
}) => {
  if (!dialog) return null;
  if (dialog.kind === 'delete')
    return (
      <JournalDeleteDialog
        entry={dialog.entry}
        remove={remove}
        onDeleted={onDeleted}
        onCancel={onCancel}
      />
    );
  return (
    <JournalRenameDialog
      entry={dialog.entry}
      rename={rename}
      onRenamed={onRenamed}
      onCancel={onCancel}
    />
  );
};

const JournalRowActions = ({ entry, disabled, snapshot, ...actions }: Props) => {
  const { popover, dialog, error, choose, dismiss, setDialog } = useRowActions(entry, snapshot);
  const menuId = useId();
  return (
    <div className="mr-2">
      <button
        ref={popover.anchor}
        type="button"
        aria-label={`Actions for ${entry.title || 'Untitled entry'}`}
        aria-haspopup="menu"
        aria-expanded={popover.open}
        aria-controls={popover.open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (popover.open ? dismiss() : popover.show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            popover.show();
          }
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:opacity-100 text-gray-500 hover:bg-indigo/10 hover:text-indigo focus-visible:ring-2 focus-visible:ring-indigo disabled:opacity-40"
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {error && (
        <span role="alert" className="text-xs text-rose-700">
          {error}
        </span>
      )}
      {popover.open &&
        createPortal(
          <div
            id={menuId}
            ref={popover.popup}
            role="menu"
            tabIndex={-1}
            aria-label="Entry actions"
            style={popover.position}
            onKeyDown={(event) => menuKey(event, dismiss)}
            className="fixed z-50 w-40 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => choose('rename')}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-navy hover:bg-indigo/5 focus:bg-indigo/5"
            >
              <Pencil size={16} aria-hidden="true" />
              Rename
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => choose('delete')}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-700 hover:bg-rose-50 focus:bg-rose-50"
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>,
          document.body
        )}
      <RowDialog dialog={dialog} {...actions} onCancel={() => setDialog(null)} />
    </div>
  );
};

export default JournalRowActions;
