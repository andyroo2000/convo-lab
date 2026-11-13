import { Link } from 'react-router-dom';
import type useJournalArchive from './useJournalArchive';

type Archive = ReturnType<typeof useJournalArchive>;
interface RowProps {
  entry: Archive['entries'][number];
  selected: boolean;
}

const JournalArchiveRow = ({ entry, selected }: RowProps) => {
  const title = entry.title || 'Untitled entry';
  return (
    <li
      className={`group rounded-xl border ${selected ? 'border-indigo/30 bg-indigo/5' : 'border-gray-100 bg-white'}`}
    >
      <div className="flex items-center">
        <Link
          to={`/app/journal/${entry.id}`}
          aria-current={selected ? 'page' : undefined}
          className="min-w-0 flex-1 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-indigo"
        >
          <span className="block truncate font-medium text-navy">{title}</span>
          <span className="mt-1 block text-xs text-gray-500">{entry.entryDate}</span>
        </Link>
      </div>
    </li>
  );
};

export default JournalArchiveRow;
