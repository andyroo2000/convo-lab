import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StudyBookSource } from '@languageflow/shared/src/types';
import StudySourceChapterFields from './StudySourceChapterFields';
import { useStudyPiles } from '../../../hooks/useStudyPiles';

interface Props {
  value: StudyBookSource | null;
  onChange: (source: StudyBookSource | null) => void;
  disabled?: boolean;
}
const MissingSourceOption = ({
  source,
  known,
}: {
  source: StudyBookSource | null;
  known: boolean;
}) => {
  const { t } = useTranslation('study');
  return source && !known ? (
    <option value={source.pileId}>{t('piles.unavailableSource')}</option>
  ) : null;
};

const StudyBookSourceFields = ({ value, onChange, disabled = false }: Props) => {
  const { t } = useTranslation('study');
  const id = useId();
  const query = useStudyPiles();
  const piles = query.data?.piles ?? [];
  const book = piles.find((pile) => pile.id === value?.pileId);
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 font-bold text-navy">{t('piles.cardSource')}</legend>
      <label htmlFor={`${id}-book`} className="block text-sm font-semibold">
        {t('piles.book')}
      </label>
      <select
        id={`${id}-book`}
        value={value?.pileId ?? ''}
        disabled={query.isLoading || query.isError}
        onChange={(event) => onChange(event.target.value ? { pileId: event.target.value } : null)}
        className="min-h-11 w-full rounded border border-gray-300 bg-white px-3"
      >
        <option value="">{t('piles.uncategorized')}</option>
        <MissingSourceOption source={value} known={Boolean(book)} />
        {piles.map((pile) => (
          <option key={pile.id} value={pile.id}>
            {pile.title}
            {pile.is_active ? '' : ` — ${t('piles.parkedBooks')}`}
          </option>
        ))}
      </select>
      {value && <StudySourceChapterFields value={value} onChange={onChange} book={book} />}
      {query.isError && (
        <p role="alert" className="text-sm text-red-700">
          {query.error.message}
        </p>
      )}
      <Link to="/app/study/piles" className="inline-block min-h-11 py-3 text-sm underline">
        {t('piles.manage')}
      </Link>
    </fieldset>
  );
};
export default StudyBookSourceFields;
