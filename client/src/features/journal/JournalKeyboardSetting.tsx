import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import JournalKeyboardDialog from './JournalKeyboardDialog';

const JournalKeyboardSetting = () => {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="journal-menu-item"
        aria-haspopup="dialog"
        onClick={(event) => setOpener(event.currentTarget)}
      >
        <Keyboard size={18} aria-hidden="true" />
        Keyboard
      </button>
      {opener && <JournalKeyboardDialog opener={opener} onClose={() => setOpener(null)} />}
    </>
  );
};
export default JournalKeyboardSetting;
