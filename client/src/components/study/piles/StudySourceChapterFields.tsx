import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyBookSource } from '@languageflow/shared/src/types';
import type { StudyPile } from '../../../lib/studyPilesApi';

interface Props {
  value: StudyBookSource;
  onChange: (source: StudyBookSource) => void;
  book: StudyPile | undefined;
}
const StudySourceChapterFields = ({ value, onChange, book }: Props) => {
  const { t } = useTranslation('study');
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-chapter`} className="block text-sm font-semibold">
        {t('piles.chapter')}
      </label>
      <select
        id={`${id}-chapter`}
        value={value.chapterId ?? ''}
        disabled={!book}
        onChange={(event) => onChange({ ...value, chapterId: event.target.value || null })}
        className="min-h-11 w-full rounded border border-gray-300 bg-white px-3"
      >
        <option value="">{t('piles.noChapter')}</option>
        {value.chapterId && !book?.chapters.some((chapter) => chapter.id === value.chapterId) && (
          <option value={value.chapterId}>{t('piles.unavailableChapter')}</option>
        )}
        {book?.chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.title}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-order`} className="text-sm font-semibold">
          {t('piles.cardOrder')}
          <input
            id={`${id}-order`}
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={value.position ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                position: event.target.value === '' ? null : Number(event.target.value),
              })
            }
            className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3"
          />
        </label>
        <label htmlFor={`${id}-reference`} className="text-sm font-semibold">
          {t('piles.reference')}
          <input
            id={`${id}-reference`}
            value={value.reference ?? ''}
            maxLength={512}
            onChange={(event) => onChange({ ...value, reference: event.target.value || null })}
            className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3"
          />
        </label>
      </div>
    </>
  );
};
export default StudySourceChapterFields;
