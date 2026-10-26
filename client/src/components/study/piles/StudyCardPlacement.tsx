import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { assignStudyCardSource, setStudyCardLearnSoon } from '../../../lib/studyCardPlacementApi';
import useStudyMutationWithInvalidations from '../../../lib/studyQueryInvalidation';
import StudyBookSourceFields from './StudyBookSourceFields';

const scopes = ['cards', 'browser', 'new-queue', 'overview', 'piles'] as const;
const StudyCardPlacement = ({ card }: { card: StudyCardSummary }) => {
  const { t } = useTranslation('study');
  const checkboxId = useId();
  const [source, setSource] = useState(card.bookSource ?? null);
  const [saved, setSaved] = useState(false);
  const id = card.syncId ?? card.id;
  const sourceMutation = useStudyMutationWithInvalidations(
    () => assignStudyCardSource(id, source),
    scopes
  );
  const soonMutation = useStudyMutationWithInvalidations(
    (soon: boolean) => setStudyCardLearnSoon(id, soon),
    scopes
  );
  const busy = sourceMutation.isPending || soonMutation.isPending;
  return (
    <section className="rounded-lg border border-gray-200 bg-cream p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sourceMutation.mutate(undefined, { onSuccess: () => setSaved(true) });
        }}
      >
        <StudyBookSourceFields
          value={source}
          onChange={(value) => {
            setSource(value);
            setSaved(false);
          }}
          disabled={busy}
        />
        <button type="submit" disabled={busy} className="app-button-secondary">
          {t('piles.saveSource')}
        </button>
        {saved && (
          <p role="status" className="mt-2 text-sm">
            {t('piles.sourceSaved')}
          </p>
        )}
        {sourceMutation.isError && (
          <p role="alert" className="mt-2 text-red-700">
            {sourceMutation.error.message}
          </p>
        )}
      </form>
      {card.state.queueState === 'new' && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <label htmlFor={checkboxId} className="flex min-h-11 items-center gap-3 font-semibold">
            <input
              id={checkboxId}
              type="checkbox"
              checked={card.learnSoon ?? false}
              disabled={busy}
              onChange={(event) => soonMutation.mutate(event.target.checked)}
              className="size-5 accent-navy"
            />
            {t('piles.learnSoon')}
          </label>
          <p className="text-sm text-gray-600">{t('piles.learnSoonHint')}</p>
          {soonMutation.isError && (
            <p role="alert" className="text-red-700">
              {soonMutation.error.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
export default StudyCardPlacement;
