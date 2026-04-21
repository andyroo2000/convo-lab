import type { StudyCardSummary } from '@shared/types';

import StudyCardFormFields from './StudyCardFormFields';
import { useStudyCardForm } from './studyCardFormModel';

interface StudyCardEditorProps {
  card: StudyCardSummary;
  onCancel: () => void;
  onSave: (payload: {
    prompt: StudyCardSummary['prompt'];
    answer: StudyCardSummary['answer'];
  }) => Promise<void> | void;
  isSaving?: boolean;
  error?: string | null;
}

const StudyCardEditor = ({
  card,
  onCancel,
  onSave,
  isSaving = false,
  error,
}: StudyCardEditorProps) => {
  const { values, setField, buildPayload } = useStudyCardForm({ card });

  return (
    <form
      data-testid="study-card-editor"
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const { prompt, answer } = buildPayload();
        await onSave({ prompt, answer });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-navy">Edit card</h3>
          <p className="text-sm text-gray-500">
            Save returns you to the front of this card in review mode.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
          {card.cardType}
        </span>
      </div>
      <StudyCardFormFields
        values={values}
        idPrefix="study-edit"
        includeSentenceFields
        onFieldChange={setField}
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default StudyCardEditor;
