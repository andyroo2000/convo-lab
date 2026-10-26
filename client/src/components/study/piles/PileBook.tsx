import { useTranslation } from 'react-i18next';
import type { StudyPile } from '../../../lib/studyPilesApi';
import PileRow from './PileRow';
import PileForm from './PileForm';

const PileBook = ({ pile }: { pile: StudyPile }) => {
  const { t } = useTranslation('study');
  const nextPosition = Math.max(-1, ...pile.chapters.map((chapter) => chapter.position)) + 1;
  return (
    <article className="rounded-xl border border-navy/15 bg-white px-5 shadow-sm">
      <PileRow item={pile} />
      <details className="border-t border-gray-200 pb-4">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-navy">
          {t('piles.chapters', { count: pile.chapters.length })}
        </summary>
        <p className="mb-3 text-sm text-gray-600">{t('piles.chapterHint')}</p>
        <div className="divide-y divide-gray-200 border-l-4 border-cyan pl-4">
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
