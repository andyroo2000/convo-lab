import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyBookSource } from '@languageflow/shared/src/types';
import StudyBookSourceFields from './StudyBookSourceFields';

interface Props {
  source: StudyBookSource | null;
  setSource: (source: StudyBookSource | null) => void;
  learnSoon: boolean;
  setLearnSoon: (value: boolean) => void;
  disabled: boolean;
}
const StudyCreationSource = ({ source, setSource, learnSoon, setLearnSoon, disabled }: Props) => {
  const { t } = useTranslation('study');
  const id = useId();
  return (
    <details className="rounded-lg border border-gray-200 bg-cream p-4">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">
        {t('piles.creationSource')}
      </summary>
      <StudyBookSourceFields value={source} onChange={setSource} disabled={disabled} />
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          id={id}
          type="checkbox"
          checked={learnSoon}
          disabled={disabled}
          onChange={(event) => setLearnSoon(event.target.checked)}
          className="size-5 accent-navy"
        />
        {t('piles.learnSoon')}
      </label>
      <p className="text-sm text-gray-600">{t('piles.learnSoonHint')}</p>
    </details>
  );
};
export default StudyCreationSource;
