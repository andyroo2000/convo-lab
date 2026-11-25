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
    <section aria-label={t('piles.shelf')} className="text-[var(--leaf-ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--leaf-serif)] text-2xl font-semibold">
          {t('piles.shelf')}
        </h2>
        <Link className="min-h-11 py-3 leaf-link underline" to="/app/study/piles">
          {t('piles.manage')}
        </Link>
      </div>
      <p className="mb-3 text-sm text-[#53655c]">{t('piles.shelfHint')}</p>
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
      {query.data && (
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map(({ id, title, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={disabled || count === 0 || query.isError}
              onClick={() => onBeginLesson(id)}
              className="flex min-h-16 items-center gap-3 rounded-md border border-[var(--leaf-line)] p-3 text-left enabled:hover:bg-[#e5edf4] disabled:opacity-55"
            >
              <Icon
                aria-hidden="true"
                className="size-8 shrink-0 border-r border-[var(--leaf-line)] pr-2 text-[#52765b]"
              />
              <span className="min-w-0">
                <span className="block break-words font-[family-name:var(--leaf-serif)] text-xl font-semibold">
                  {title}
                </span>
                <span className="text-sm text-gray-600">{t('piles.ready', { count })}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default StudyPileShelf;
