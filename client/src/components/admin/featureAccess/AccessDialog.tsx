import { useId, type ReactNode } from 'react';
import useJournalModal from '../../../features/journal/useJournalModal';
import './featureAccess.css';

interface Props {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}
const AccessDialog = ({ title, busy = false, onClose, children }: Props) => {
  const ref = useJournalModal();
  const id = useId();
  return (
    <dialog
      ref={ref}
      className="access-dialog"
      aria-labelledby={id}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button type="button" aria-label="Close" disabled={busy} onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
};
export default AccessDialog;
