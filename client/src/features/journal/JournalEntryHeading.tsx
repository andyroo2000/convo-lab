import type { JournalDraft } from './types';

function notebookDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${weekday}）`;
}

const JournalEntryHeading = ({ draft }: { draft: JournalDraft | null }) => {
  if (!draft) return null;
  return (
    <header className="journal-paper-heading">
      <time dateTime={draft.entryDate} className="journal-paper-date">
        {notebookDate(draft.entryDate)}
      </time>
      <h1 className="journal-paper-title">{draft.title || 'Untitled entry'}</h1>
    </header>
  );
};

export default JournalEntryHeading;
