import type { ReactNode } from 'react';

interface Props {
  busy: boolean;
  valid: boolean;
  onClose: () => void;
  onSave: () => void;
  label: string;
  children: ReactNode;
}
const AccessSaveFooter = ({ busy, valid, onClose, onSave, label, children }: Props) => (
  <footer>
    <span>{children}</span>
    <div>
      <button type="button" disabled={busy} onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="access-primary" disabled={busy || !valid} onClick={onSave}>
        {busy ? 'Saving…' : label}
      </button>
    </div>
  </footer>
);
export default AccessSaveFooter;
