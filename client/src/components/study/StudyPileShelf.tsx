import { BookOpen, Bookmark, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { StudyPileCatalog } from '../../lib/studyPilesApi';
import { useStudyPiles } from '../../hooks/useStudyPiles';

interface Props {
  onBeginLesson: (pileId?: string) => void;
  disabled: boolean;
}
const shelfChoices = (catalog: StudyPileCatalog | undefined, t: TFunction<'study'>) => {
  const books = catalog?.piles.filter((pile) => pile.is_active) ?? [];
  return [
    {
      id: 'learn-soon',
      title: t('piles.learnSoon'),
      count: catalog?.learn_soon?.ready_count ?? 0,
      icon: Bookmark,
    },
    ...books.map((pile) => ({
      id: pile.id,
      title: pile.title,
      count: pile.ready_count,
      icon: BookOpen,
    })),
    {
      id: 'uncategorized',
      title: t('piles.uncategorized'),
      count: catalog?.uncategorized?.ready_count ?? 0,
      icon: Layers,
    },
  ];
};

const StudyPileShelf = ({ onBeginLesson, disabled }: Props) => {
  const { t } = useTranslation('study');
  const query = useStudyPiles();
  const choices = shelfChoices(query.data, t);
  return (
    <section
      aria-label={t('piles.shelf')}
      className="rounded-xl border border-navy/15 bg-cream p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">{t('piles.shelf')}</h2>
        <Link className="min-h-11 py-3 font-semibold text-navy underline" to="/app/study/piles">
          {t('piles.manage')}
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-600">{t('piles.shelfHint')}</p>
      {query.isLoading && <p role="status">{t('piles.loading')}</p>}
      {query.isError && (
        <button
          type="button"
          className="min-h-11 underline"
          onClick={() => {
            query.refetch().catch(() => undefined);
          }}
        >
          {t('piles.retry')}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {choices.map(({ id, title, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled || count === 0 || query.isError}
            onClick={() => onBeginLesson(id)}
            className="min-h-32 rounded-lg border border-navy/20 border-l-8 bg-white p-4 text-left shadow-sm transition hover:bg-cyan/10 focus-visible:outline-cyan disabled:opacity-50"
          >
            <Icon aria-hidden="true" className="mb-3 size-5 text-navy" />
            <span className="block font-bold text-navy">{title}</span>
            <span className="text-sm text-gray-600">{t('piles.ready', { count })}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default StudyPileShelf;
