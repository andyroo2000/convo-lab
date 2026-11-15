interface Props {
  visible: boolean;
  translationId: string;
  onToggle: () => void;
}

const JournalEnglish = ({ visible, translationId, onToggle }: Props) => (
  <button
    type="button"
    className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs font-semibold ${visible ? 'bg-indigo text-white hover:bg-indigo/90' : 'bg-white/70 text-indigo hover:bg-white'}`}
    aria-label={visible ? 'Hide English' : 'Show English'}
    aria-expanded={visible}
    aria-pressed={visible}
    aria-controls={translationId}
    onClick={onToggle}
  >
    En
  </button>
);
export default JournalEnglish;
