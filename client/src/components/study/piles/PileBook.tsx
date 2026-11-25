import { useTranslation } from 'react-i18next';
import type { StudyPile } from '../../../lib/studyPilesApi';
import PileRow from './PileRow';
import PileForm from './PileForm';

const PileBook = ({ pile }: { pile: StudyPile }) => {
  const { t } = useTranslation('study');
  const nextPosition = Math.max(-1, ...pile.chapters.map((chapter) => chapter.position)) + 1;
  return (
    <article className="py-2">
      <PileRow item={pile} />
      <details className="rounded-md bg-[var(--pile-vellum)] px-3 pb-1">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {t('piles.chapters', { count: pile.chapters.length })}
        </summary>
        <div className="pl-2">
          {pile.chapters.map((chapter) => (
            <PileRow key={chapter.id} item={chapter} pileId={pile.id} />
          ))}
        </div>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t('piles.addChapter')}
          </summary>
          <PileForm pileId={pile.id} position={nextPosition} />
        </details>
      </details>
    </article>
  );
};

export default PileBook;
