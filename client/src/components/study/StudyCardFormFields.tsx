import type { StudyCardType } from '@shared/types';

import StudyFormField from './StudyFormField';
import type { StudyCardFormValues } from './studyCardFormModel';

interface StudyCardFormFieldsProps {
  values: StudyCardFormValues;
  idPrefix: string;
  includeCardTypeSelect?: boolean;
  includeSentenceFields?: boolean;
  onCardTypeChange?: (cardType: StudyCardType) => void;
  onFieldChange: <K extends keyof StudyCardFormValues>(
    field: K,
    value: StudyCardFormValues[K]
  ) => void;
}

const StudyCardFormFields = ({
  values,
  idPrefix,
  includeCardTypeSelect = false,
  includeSentenceFields = false,
  onCardTypeChange,
  onFieldChange,
}: StudyCardFormFieldsProps) => (
  <>
    {includeCardTypeSelect ? (
      <StudyFormField htmlFor={`${idPrefix}-card-type`} label="Card type">
        <select
          id={`${idPrefix}-card-type`}
          value={values.cardType}
          onChange={(event) => onCardTypeChange?.(event.target.value as StudyCardType)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        >
          <option value="recognition">Recognition</option>
          <option value="production">Production</option>
          <option value="cloze">Cloze</option>
        </select>
      </StudyFormField>
    ) : null}

    <StudyFormField
      htmlFor={`${idPrefix}-cue-text`}
      label={values.cardType === 'cloze' ? 'Cloze text' : 'Prompt text'}
    >
      <textarea
        id={`${idPrefix}-cue-text`}
        value={values.cueText}
        onChange={(event) => onFieldChange('cueText', event.target.value)}
        className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        required
      />
    </StudyFormField>

    {values.cardType === 'cloze' ? (
      <StudyFormField htmlFor={`${idPrefix}-cloze-hint`} label="Cloze hint">
        <input
          id={`${idPrefix}-cloze-hint`}
          value={values.cueMeaning}
          onChange={(event) => onFieldChange('cueMeaning', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </StudyFormField>
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        <StudyFormField htmlFor={`${idPrefix}-cue-reading`} label="Prompt reading">
          <input
            id={`${idPrefix}-cue-reading`}
            value={values.cueReading}
            onChange={(event) => onFieldChange('cueReading', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>
        <StudyFormField htmlFor={`${idPrefix}-cue-meaning`} label="Prompt meaning / hint">
          <input
            id={`${idPrefix}-cue-meaning`}
            value={values.cueMeaning}
            onChange={(event) => onFieldChange('cueMeaning', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>
      </div>
    )}

    <div className="grid gap-4 md:grid-cols-2">
      <StudyFormField
        htmlFor={`${idPrefix}-answer-expression`}
        label={values.cardType === 'cloze' ? 'Restored answer' : 'Answer expression'}
      >
        <input
          id={`${idPrefix}-answer-expression`}
          value={values.answerExpression}
          onChange={(event) => onFieldChange('answerExpression', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          required
        />
      </StudyFormField>
      <StudyFormField htmlFor={`${idPrefix}-answer-reading`} label="Answer reading">
        <input
          id={`${idPrefix}-answer-reading`}
          value={values.answerReading}
          onChange={(event) => onFieldChange('answerReading', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          disabled={values.cardType === 'cloze'}
        />
      </StudyFormField>
    </div>

    <StudyFormField htmlFor={`${idPrefix}-answer-meaning`} label="Answer meaning">
      <input
        id={`${idPrefix}-answer-meaning`}
        value={values.answerMeaning}
        onChange={(event) => onFieldChange('answerMeaning', event.target.value)}
        className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
      />
    </StudyFormField>

    {includeSentenceFields && values.cardType !== 'cloze' ? (
      <div className="grid gap-4 md:grid-cols-2">
        <StudyFormField htmlFor={`${idPrefix}-sentence-jp`} label="Example sentence (JP)">
          <textarea
            id={`${idPrefix}-sentence-jp`}
            value={values.sentenceJp}
            onChange={(event) => onFieldChange('sentenceJp', event.target.value)}
            className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>
        <StudyFormField htmlFor={`${idPrefix}-sentence-en`} label="Example sentence (EN)">
          <textarea
            id={`${idPrefix}-sentence-en`}
            value={values.sentenceEn}
            onChange={(event) => onFieldChange('sentenceEn', event.target.value)}
            className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>
      </div>
    ) : null}

    <StudyFormField htmlFor={`${idPrefix}-notes`} label="Notes">
      <textarea
        id={`${idPrefix}-notes`}
        value={values.notes}
        onChange={(event) => onFieldChange('notes', event.target.value)}
        className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
      />
    </StudyFormField>
  </>
);

export default StudyCardFormFields;
