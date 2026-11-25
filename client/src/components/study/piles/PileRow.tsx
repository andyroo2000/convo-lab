import { Book } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveStudyPile } from '../../../hooks/useStudyPiles';
import type { StudyPileChapter } from '../../../lib/studyPilesApi';
import PileForm from './PileForm';

const PileRow = ({ item, pileId }: { item: StudyPileChapter; pileId?: string }) => {
  const toggleId = useId();
  const { t } = useTranslation('study');
  const mutation = useSaveStudyPile();
  const isActive = mutation.isPending
    ? (mutation.variables?.attributes.is_active ?? item.is_active)
    : item.is_active;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 break-words font-[family-name:var(--leaf-serif)] text-xl">
            {!pileId && (
              <Book aria-hidden="true" className="size-8 shrink-0 rounded bg-[#d8e5cd] p-1.5" />
            )}
            {item.title}
          </h3>
          <details className="text-sm text-[#53645a]">
            <summary className="min-h-11 cursor-pointer py-3">
              {t('piles.ready', { count: item.ready_count })}
            </summary>
            {t('piles.countDetails', { remaining: item.new_count, learned: item.introduced_count })}
          </details>
        </div>
        <label
          htmlFor={toggleId}
          className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold"
        >
          <input
            id={toggleId}
            type="checkbox"
            checked={isActive}
            disabled={mutation.isPending}
            aria-label={t('piles.include', { title: item.title })}
            onChange={(event) =>
              mutation.mutate({
                id: item.id,
                pileId,
                attributes: { is_active: event.target.checked },
              })
            }
            className="size-5 accent-[#376646]"
          />
          {t(isActive ? 'piles.active' : 'piles.parked')}
        </label>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-gray-600">
          {t('piles.edit')}
        </summary>
        <PileForm key={`${item.title}-${item.position}`} item={item} pileId={pileId} />
      </details>
    </div>
  );
};

export default PileRow;
