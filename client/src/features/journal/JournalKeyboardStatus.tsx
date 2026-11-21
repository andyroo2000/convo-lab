import { saveKeyboardMode } from './journalKeyboardPreference';

const JournalKeyboardStatus = ({ state, retry }: { state: string; retry: () => void }) => (
  <div className="journal-keyboard-status" role="status">
    <span>
      {state === 'error' ? 'Couldn’t prepare Japanese input.' : 'Preparing Japanese input…'}
    </span>
    {state === 'error' && (
      <button type="button" onClick={retry}>
        Try again
      </button>
    )}
    <button type="button" onClick={() => saveKeyboardMode('device')}>
      Use my keyboard
    </button>
  </div>
);
export default JournalKeyboardStatus;
