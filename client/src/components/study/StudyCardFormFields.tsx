import type { StudyCardType } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import VoiceSelect from '../common/VoiceSelect';
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
}: StudyCardFormFieldsProps) => {
  const { t } = useTranslation('study');

  return (
    <>
      {includeCardTypeSelect ? (
        <StudyFormField htmlFor={`${idPrefix}-card-type`} label={t('form.cardType')}>
          <select
            id={`${idPrefix}-card-type`}
            value={values.cardType}
            onChange={(event) => onCardTypeChange?.(event.target.value as StudyCardType)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          >
            <option value="recognition">{t('form.recognition')}</option>
            <option value="production">{t('form.production')}</option>
            <option value="cloze">{t('form.cloze')}</option>
          </select>
        </StudyFormField>
      ) : null}

      <StudyFormField
        htmlFor={`${idPrefix}-cue-text`}
        label={values.cardType === 'cloze' ? t('form.clozeText') : t('form.promptText')}
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
        <StudyFormField htmlFor={`${idPrefix}-cloze-hint`} label={t('form.clozeHint')}>
          <input
            id={`${idPrefix}-cloze-hint`}
            value={values.cueMeaning}
            onChange={(event) => onFieldChange('cueMeaning', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <StudyFormField htmlFor={`${idPrefix}-cue-reading`} label={t('form.promptReading')}>
            <input
              id={`${idPrefix}-cue-reading`}
              value={values.cueReading}
              onChange={(event) => onFieldChange('cueReading', event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>
          <StudyFormField htmlFor={`${idPrefix}-cue-meaning`} label={t('form.promptMeaning')}>
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
          label={
            values.cardType === 'cloze' ? t('form.restoredAnswer') : t('form.answerExpression')
          }
        >
          <input
            id={`${idPrefix}-answer-expression`}
            value={values.answerExpression}
            onChange={(event) => onFieldChange('answerExpression', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            required
          />
        </StudyFormField>
        <StudyFormField htmlFor={`${idPrefix}-answer-reading`} label={t('form.answerReading')}>
          <input
            id={`${idPrefix}-answer-reading`}
            value={values.answerReading}
            onChange={(event) => onFieldChange('answerReading', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            disabled={values.cardType === 'cloze'}
          />
        </StudyFormField>
      </div>

      <StudyFormField htmlFor={`${idPrefix}-answer-meaning`} label={t('form.answerMeaning')}>
        <input
          id={`${idPrefix}-answer-meaning`}
          value={values.answerMeaning}
          onChange={(event) => onFieldChange('answerMeaning', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </StudyFormField>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Study cards are Japanese-only for now; derive this from card language if that changes. */}
        <VoiceSelect
          id={`${idPrefix}-answer-audio-voice`}
          label={t('form.answerAudioVoice')}
          language="ja"
          value={values.answerAudioVoiceId}
          onChange={(voiceId) => onFieldChange('answerAudioVoiceId', voiceId)}
        />
        <StudyFormField
          htmlFor={`${idPrefix}-answer-audio-override`}
          label={t('form.answerAudioTextOverride')}
        >
          <input
            id={`${idPrefix}-answer-audio-override`}
            value={values.answerAudioTextOverride}
            onChange={(event) => onFieldChange('answerAudioTextOverride', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            placeholder={t('form.answerAudioTextOverridePlaceholder')}
          />
        </StudyFormField>
      </div>

      {includeSentenceFields && values.cardType !== 'cloze' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StudyFormField htmlFor={`${idPrefix}-sentence-jp`} label={t('form.sentenceJp')}>
            <textarea
              id={`${idPrefix}-sentence-jp`}
              value={values.sentenceJp}
              onChange={(event) => onFieldChange('sentenceJp', event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>
          <StudyFormField htmlFor={`${idPrefix}-sentence-en`} label={t('form.sentenceEn')}>
            <textarea
              id={`${idPrefix}-sentence-en`}
              value={values.sentenceEn}
              onChange={(event) => onFieldChange('sentenceEn', event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>
        </div>
      ) : null}

      <StudyFormField htmlFor={`${idPrefix}-notes`} label={t('form.notes')}>
        <textarea
          id={`${idPrefix}-notes`}
          value={values.notes}
          onChange={(event) => onFieldChange('notes', event.target.value)}
          className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </StudyFormField>
    </>
  );
};

export default StudyCardFormFields;
