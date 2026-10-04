import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useReadings from '../features/readings/useReadings';
import { getReading } from '../features/readings/readingsApi';
import ReadingReader from '../features/readings/ReadingReader';
import '../features/readings/readings.css';

const ReadingLibrary = () => {
  const readings = useReadings();
  if (readings.isLoading) return <p role="status">Loading readings…</p>;
  if (readings.error)
    return (
      <div role="alert">
        Could not load your readings.{' '}
        <button
          type="button"
          onClick={() => {
            readings.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  return (
    <div className="readings-library">
      <h1>Readings</h1>
      <p className="readings-subtitle">Your personal bookshelf</p>
      {!readings.data?.length && <p>No readings yet.</p>}
      <div className="reading-shelf">
        {readings.data?.map((reading) => (
          <Link className="reading-book-link" key={reading.id} to={`/app/readings/${reading.id}`}>
            <BookOpen size={32} aria-hidden="true" />
            <h2 lang="ja">{reading.title}</h2>
            <p lang="ja">{reading.author}</p>
            <span>{reading.pageCount} pages</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

const ReadingDetail = ({ id }: { id: string }) => {
  const { user } = useAuth();
  const reading = useQuery({
    queryKey: ['reading', user?.id, id],
    queryFn: ({ signal }) => getReading(id, signal),
    enabled: Boolean(user),
  });
  if (reading.isLoading) return <p role="status">Opening reading…</p>;
  if (reading.error || !reading.data)
    return (
      <div role="alert">
        This reading could not be opened. <Link to="/app/readings">Back to readings</Link>
      </div>
    );
  return (
    <section className="readings-detail" aria-label={reading.data.title}>
      <h1 className="sr-only" lang="ja">
        {reading.data.title}
      </h1>
      <ReadingReader key={`${user?.id}:${id}`} reading={reading.data} />
    </section>
  );
};

const ReadingsPage = () => {
  const { readingId } = useParams();
  const [search] = useSearchParams();
  if (search.has('viewAs')) return <p>Readings are private to your own account.</p>;
  return readingId ? <ReadingDetail id={readingId} /> : <ReadingLibrary />;
};

export default ReadingsPage;
