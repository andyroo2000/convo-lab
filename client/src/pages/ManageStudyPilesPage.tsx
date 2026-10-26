import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStudyPiles } from '../hooks/useStudyPiles';
import PileBook from '../components/study/piles/PileBook';
import PileForm from '../components/study/piles/PileForm';

const ManageStudyPilesPage = () => {
  const { t } = useTranslation('study');
  const query = useStudyPiles();
  const piles = query.data?.piles ?? [];
  const sections = [
    { title: t('piles.activeBooks'), books: piles.filter((pile) => pile.is_active) },
    { title: t('piles.parkedBooks'), books: piles.filter((pile) => !pile.is_active) },
  ];
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link to="/app/study" className="inline-block min-h-11 py-3 font-semibold underline">
        {t('piles.back')}
      </Link>
      <header>
        <h1 className="text-3xl font-bold text-navy">{t('piles.manage')}</h1>
        <p className="mt-3 text-gray-600">{t('piles.manageHint')}</p>
      </header>
      {query.isLoading && <p role="status">{t('piles.loading')}</p>}
      {query.isError && (
        <div role="alert">
          <p>{query.error.message}</p>
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => {
              query.refetch().catch(() => undefined);
            }}
          >
            {t('piles.retry')}
          </button>
        </div>
      )}
      {sections.map(({ title, books }) => (
        <section key={title} className="space-y-3">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          {books.map((pile) => (
            <PileBook key={pile.id} pile={pile} />
          ))}
          {!query.isLoading && !query.isError && books.length === 0 && (
            <p className="text-sm text-gray-500">{t('piles.empty')}</p>
          )}
        </section>
      ))}
      <section className="rounded-xl border border-dashed border-navy/30 bg-cream p-5">
        <h2 className="font-bold text-navy">{t('piles.addBook')}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('piles.importHint')}</p>
        <PileForm position={Math.max(-1, ...piles.map((pile) => pile.position)) + 1} />
      </section>
    </main>
  );
};

export default ManageStudyPilesPage;
