import { useState } from 'react';
import '../components/study/studyNotebook.css';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStudyPiles } from '../hooks/useStudyPiles';
import PileBook from '../components/study/piles/PileBook';
import PileForm from '../components/study/piles/PileForm';

const ManageStudyPilesPage = () => {
  const { t } = useTranslation('study');
  const [active, setActive] = useState(true);
  const query = useStudyPiles();
  const piles = query.data?.piles ?? [];
  const visible = piles.filter((pile) => pile.is_active === active);
  const activeCount = piles.filter((pile) => pile.is_active).length;
  return (
    <main className="study-notebook mx-auto w-full max-w-4xl px-4 py-8">
      <Link to="/app/study" className="inline-block min-h-11 py-3 font-semibold underline">
        {t('piles.back')}
      </Link>
      <header className="study-dateline flex-wrap">
        <h1 className="text-3xl">{t('piles.pageTitle')}</h1>
        <details className="group">
          <summary className="study-action primary-leaf inline-flex cursor-pointer items-center">
            {t('piles.addBook')}
          </summary>
          <PileForm position={Math.max(-1, ...piles.map((pile) => pile.position)) + 1} />
        </details>
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
      <section>
        <div className="flex gap-1">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              aria-pressed={active === on}
              onClick={() => setActive(on)}
              className="min-h-11 rounded-t-lg bg-[#efecdf] px-3 font-[family-name:var(--leaf-serif)] text-lg aria-pressed:bg-[#376646] aria-pressed:text-white"
            >
              {t(on ? 'piles.activeBooks' : 'piles.parkedBooks')} (
              {on ? activeCount : piles.length - activeCount})
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-b-lg bg-[var(--leaf-paper)] p-4 shadow-[3px_4px_0_#dfe5de]">
          {visible.map((pile) => (
            <PileBook key={pile.id} pile={pile} />
          ))}
          {query.isSuccess && !visible.length && <p>{t('piles.empty')}</p>}
        </div>
      </section>
    </main>
  );
};

export default ManageStudyPilesPage;
